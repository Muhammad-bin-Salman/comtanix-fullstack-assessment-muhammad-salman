<?php

namespace Tests\Feature\Audit;

use App\Enums\QuoteRequestStatus;
use App\Jobs\PublishAuditEvent;
use App\Models\QuoteRequest;
use App\Models\User;
use App\Services\AuditEventPublisher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use RuntimeException;
use Tests\TestCase;

class AuditEventPublishingTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_quote_creation_dispatches_a_finalized_audit_event(): void
    {
        Queue::fake();

        $response = $this->postJson('/api/public/quote-requests', $this->publicQuotePayload())
            ->assertCreated();

        $quoteRequestId = $response->json('data.id');

        Queue::assertPushed(PublishAuditEvent::class, function (PublishAuditEvent $job) use ($quoteRequestId) {
            return Str::isUuid($job->payload['eventId'])
                && $job->payload['type'] === AuditEventPublisher::QUOTE_CREATED
                && $job->payload['quoteRequestId'] === $quoteRequestId
                && $job->payload['actorId'] === null
                && $job->payload['data'] === ['status' => QuoteRequestStatus::New->value]
                && is_string($job->payload['occurredAt'])
                && $job->afterCommit === true;
        });
    }

    public function test_successful_status_update_dispatches_event_with_actor_and_transition(): void
    {
        Queue::fake();
        $admin = $this->authenticateAdmin();
        $quoteRequest = QuoteRequest::factory()->create();

        $this->patchJson("/api/quote-requests/{$quoteRequest->id}/status", [
            'status' => QuoteRequestStatus::InReview->value,
        ])->assertOk();

        Queue::assertPushed(PublishAuditEvent::class, function (PublishAuditEvent $job) use ($admin, $quoteRequest) {
            return $job->payload['type'] === AuditEventPublisher::QUOTE_STATUS_CHANGED
                && $job->payload['quoteRequestId'] === $quoteRequest->id
                && $job->payload['actorId'] === $admin->id
                && $job->payload['data'] === [
                    'from' => QuoteRequestStatus::New->value,
                    'to' => QuoteRequestStatus::InReview->value,
                ];
        });
        Queue::assertPushed(PublishAuditEvent::class, 1);
    }

    public function test_invalid_status_transition_dispatches_no_audit_event(): void
    {
        Queue::fake();
        $this->authenticateAdmin();
        $quoteRequest = QuoteRequest::factory()->create();

        $this->patchJson("/api/quote-requests/{$quoteRequest->id}/status", [
            'status' => QuoteRequestStatus::Quoted->value,
        ])->assertUnprocessable();

        Queue::assertNothingPushed();
    }

    public function test_status_authorization_failure_dispatches_no_audit_event(): void
    {
        Queue::fake();
        Sanctum::actingAs(User::factory()->staff()->create());
        $quoteRequest = QuoteRequest::factory()->create();

        $this->patchJson("/api/quote-requests/{$quoteRequest->id}/status", [
            'status' => QuoteRequestStatus::InReview->value,
        ])->assertForbidden();

        Queue::assertNothingPushed();
    }

    public function test_assignment_dispatches_event_with_actor_and_old_and_new_assignees(): void
    {
        Queue::fake();
        $admin = $this->authenticateAdmin();
        $staffA = User::factory()->staff()->create();
        $staffB = User::factory()->staff()->create();
        $quoteRequest = QuoteRequest::factory()->assignedTo($staffA)->create();

        $this->patchJson("/api/quote-requests/{$quoteRequest->id}/assign", [
            'assigned_user_id' => $staffB->id,
        ])->assertOk();

        Queue::assertPushed(PublishAuditEvent::class, function (PublishAuditEvent $job) use ($admin, $quoteRequest, $staffA, $staffB) {
            return $job->payload['type'] === AuditEventPublisher::QUOTE_ASSIGNED
                && $job->payload['quoteRequestId'] === $quoteRequest->id
                && $job->payload['actorId'] === $admin->id
                && $job->payload['data'] === [
                    'from' => $staffA->id,
                    'to' => $staffB->id,
                ];
        });
        Queue::assertPushed(PublishAuditEvent::class, 1);
    }

    public function test_same_assignee_dispatches_no_audit_event(): void
    {
        Queue::fake();
        $this->authenticateAdmin();
        $staff = User::factory()->staff()->create();
        $quoteRequest = QuoteRequest::factory()->assignedTo($staff)->create();

        $this->patchJson("/api/quote-requests/{$quoteRequest->id}/assign", [
            'assigned_user_id' => $staff->id,
        ])->assertOk();

        Queue::assertNothingPushed();
    }

    public function test_job_signs_and_sends_the_exact_raw_json_body(): void
    {
        $this->configureAuditService();
        Http::fake(['http://audit.test/events' => Http::response(['accepted' => true], 201)]);
        $job = new PublishAuditEvent($this->auditPayload());

        $job->handle();

        Http::assertSent(function (Request $request) {
            $rawBody = $request->body();
            $expectedSignature = hash_hmac(
                'sha256',
                $rawBody,
                'test-shared-secret',
            );

            return $request->method() === 'POST'
                && $request->url() === 'http://audit.test/events'
                && $request->hasHeader('Content-Type', 'application/json')
                && $request->hasHeader('Accept', 'application/json')
                && $request->hasHeader('X-Signature', $expectedSignature)
                && $rawBody === json_encode(
                    $this->auditPayload(),
                    JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES,
                );
        });
    }

    public function test_successful_audit_response_completes_job(): void
    {
        $this->configureAuditService();
        Http::fake(['http://audit.test/events' => Http::response(null, 204)]);

        (new PublishAuditEvent($this->auditPayload()))->handle();

        Http::assertSentCount(1);
        $this->assertTrue(true);
    }

    public function test_http_failure_is_thrown_for_queue_retry(): void
    {
        $this->configureAuditService();
        Http::fake(['http://audit.test/events' => Http::response(['message' => 'Unavailable'], 503)]);

        $this->expectException(RequestException::class);

        (new PublishAuditEvent($this->auditPayload()))->handle();
    }

    public function test_event_identity_and_time_remain_stable_across_repeated_attempts(): void
    {
        $this->configureAuditService();
        $sentBodies = [];
        Http::fake(function (Request $request) use (&$sentBodies) {
            $sentBodies[] = $request->body();

            return Http::response(['accepted' => true], 200);
        });
        $job = new PublishAuditEvent($this->auditPayload());

        $job->handle();
        $job->handle();

        $this->assertCount(2, $sentBodies);
        $this->assertSame($sentBodies[0], $sentBodies[1]);
        $this->assertSame('018f47a2-5b9c-7d3e-a1b2-123456789abc', json_decode($sentBodies[1], true)['eventId']);
        $this->assertSame('2026-10-15T10:30:00.000000Z', json_decode($sentBodies[1], true)['occurredAt']);
    }

    public function test_job_fails_clearly_when_audit_url_is_missing(): void
    {
        config()->set('services.audit.url');
        config()->set('services.audit.shared_secret', 'test-shared-secret');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Audit service URL is not configured.');

        (new PublishAuditEvent($this->auditPayload()))->handle();
    }

    public function test_job_fails_clearly_when_shared_secret_is_missing(): void
    {
        config()->set('services.audit.url', 'http://audit.test');
        config()->set('services.audit.shared_secret');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Audit shared secret is not configured.');

        (new PublishAuditEvent($this->auditPayload()))->handle();
    }

    private function authenticateAdmin(): User
    {
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        return $admin;
    }

    private function configureAuditService(): void
    {
        config()->set('services.audit.url', 'http://audit.test');
        config()->set('services.audit.shared_secret', 'test-shared-secret');
        config()->set('services.audit.timeout', 5);
    }

    /**
     * @return array<string, mixed>
     */
    private function auditPayload(): array
    {
        return [
            'eventId' => '018f47a2-5b9c-7d3e-a1b2-123456789abc',
            'type' => AuditEventPublisher::QUOTE_STATUS_CHANGED,
            'quoteRequestId' => 123,
            'actorId' => 1,
            'data' => [
                'from' => QuoteRequestStatus::New->value,
                'to' => QuoteRequestStatus::InReview->value,
            ],
            'occurredAt' => '2026-10-15T10:30:00.000000Z',
        ];
    }

    /**
     * @return array<string, string|null>
     */
    private function publicQuotePayload(): array
    {
        return [
            'client_name' => 'Audit Test Client',
            'email' => 'audit@example.com',
            'company' => null,
            'service_type' => 'custom_software',
            'budget_range' => '25k_plus',
            'message' => 'Please prepare a quote for this audit publishing test.',
            'website' => '',
        ];
    }
}
