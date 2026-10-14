<?php

namespace Tests\Feature\Api;

use App\Models\QuoteRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FrontendSupportTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_list_only_staff_users_in_name_order(): void
    {
        $admin = User::factory()->admin()->create();
        $second = User::factory()->staff()->create(['name' => 'Zulu Staff']);
        $first = User::factory()->staff()->create(['name' => 'Alpha Staff']);
        Sanctum::actingAs($admin);

        $this->getJson('/api/staff-users')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $first->id)
            ->assertJsonPath('data.1.id', $second->id)
            ->assertJsonMissingPath('data.0.role')
            ->assertJsonMissingPath('data.0.password');
    }

    public function test_staff_cannot_list_staff_users(): void
    {
        Sanctum::actingAs(User::factory()->staff()->create());

        $this->getJson('/api/staff-users')->assertForbidden();
    }

    public function test_authorized_user_can_retrieve_normalized_audit_events(): void
    {
        config(['services.audit.url' => 'http://audit.test']);
        Sanctum::actingAs(User::factory()->staff()->create());
        $quoteRequest = QuoteRequest::factory()->create();

        Http::fake([
            'http://audit.test/events*' => Http::response([
                'data' => [[
                    'eventId' => '34ac08a0-3d46-4ddb-b608-74318c0b8c43',
                    'type' => 'quote.created',
                    'quoteRequestId' => $quoteRequest->id,
                    'actorId' => null,
                    'data' => ['status' => 'new'],
                    'occurredAt' => '2026-10-15T10:30:00.000Z',
                    '_id' => 'internal',
                    '__v' => 0,
                ]],
                'meta' => ['page' => 1, 'per_page' => 10, 'total' => 1, 'total_pages' => 1],
            ]),
        ]);

        $this->getJson("/api/quote-requests/{$quoteRequest->id}/audit-events?per_page=10&type=quote.created")
            ->assertOk()
            ->assertJsonPath('data.0.type', 'quote.created')
            ->assertJsonPath('meta.per_page', 10)
            ->assertJsonMissingPath('data.0._id')
            ->assertJsonMissingPath('data.0.__v');

        Http::assertSent(fn ($request): bool => $request->url() === 'http://audit.test/events?quoteRequestId='.$quoteRequest->id.'&page=1&per_page=10&type=quote.created');
    }

    public function test_unauthenticated_user_cannot_retrieve_audit_events(): void
    {
        $quoteRequest = QuoteRequest::factory()->create();

        $this->getJson("/api/quote-requests/{$quoteRequest->id}/audit-events")
            ->assertUnauthorized();
    }

    public function test_audit_service_failure_returns_controlled_bad_gateway_response(): void
    {
        config(['services.audit.url' => 'http://audit.test']);
        Sanctum::actingAs(User::factory()->staff()->create());
        $quoteRequest = QuoteRequest::factory()->create();
        Http::fake(['http://audit.test/*' => Http::response([], 500)]);

        $this->getJson("/api/quote-requests/{$quoteRequest->id}/audit-events")
            ->assertStatus(502)
            ->assertExactJson(['message' => 'Audit history is temporarily unavailable.']);
    }

    public function test_audit_query_parameters_are_validated(): void
    {
        Sanctum::actingAs(User::factory()->staff()->create());
        $quoteRequest = QuoteRequest::factory()->create();

        $this->getJson("/api/quote-requests/{$quoteRequest->id}/audit-events?page=0&per_page=101&type=unknown")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['page', 'per_page', 'type']);
    }
}
