<?php

namespace Tests\Feature\Api;

use App\Enums\QuoteRequestStatus;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicQuoteRequestTest extends TestCase
{
    use RefreshDatabase;

    public function test_valid_public_quote_submission_returns_created(): void
    {
        $response = $this->postJson('/api/public/quote-requests', $this->validPayload());

        $response
            ->assertCreated()
            ->assertJsonPath('data.client_name', 'Jane Client')
            ->assertJsonPath('data.status', QuoteRequestStatus::New->value);
    }

    public function test_public_quote_submission_does_not_require_authentication(): void
    {
        $this->postJson('/api/public/quote-requests', $this->validPayload())
            ->assertCreated();
    }

    public function test_public_quote_is_stored_as_new_and_unassigned(): void
    {
        $this->postJson('/api/public/quote-requests', $this->validPayload())
            ->assertCreated();

        $this->assertDatabaseHas('quote_requests', [
            'email' => 'jane@example.com',
            'status' => QuoteRequestStatus::New->value,
            'assigned_user_id' => null,
        ]);
    }

    public function test_invalid_email_is_rejected(): void
    {
        $this->postJson('/api/public/quote-requests', [
            ...$this->validPayload(),
            'email' => 'not-an-email',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_missing_required_fields_are_rejected(): void
    {
        $this->postJson('/api/public/quote-requests')
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'client_name',
                'email',
                'service_type',
                'message',
            ]);
    }

    public function test_populated_honeypot_is_rejected(): void
    {
        $this->postJson('/api/public/quote-requests', [
            ...$this->validPayload(),
            'website' => 'https://spam.example',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('website');

        $this->assertDatabaseCount('quote_requests', 0);
    }

    public function test_public_caller_cannot_control_status(): void
    {
        $this->postJson('/api/public/quote-requests', [
            ...$this->validPayload(),
            'status' => QuoteRequestStatus::Closed->value,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');

        $this->assertDatabaseCount('quote_requests', 0);
    }

    public function test_public_caller_cannot_control_assignment(): void
    {
        $user = User::factory()->staff()->create();

        $this->postJson('/api/public/quote-requests', [
            ...$this->validPayload(),
            'assigned_user_id' => $user->id,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('assigned_user_id');

        $this->assertDatabaseCount('quote_requests', 0);
    }

    public function test_public_quote_submission_is_rate_limited_by_ip(): void
    {
        for ($attempt = 1; $attempt <= 5; $attempt++) {
            $this->postJson('/api/public/quote-requests', $this->validPayload())
                ->assertCreated();
        }

        $this->postJson('/api/public/quote-requests', $this->validPayload())
            ->assertTooManyRequests();
    }

    public function test_response_exposes_only_intentional_fields(): void
    {
        $this->postJson('/api/public/quote-requests', $this->validPayload())
            ->assertCreated()
            ->assertJsonMissingPath('data.deleted_at')
            ->assertJsonMissingPath('data.website')
            ->assertJsonMissingPath('data.assigned_user');
    }

    /**
     * @return array<string, string|null>
     */
    private function validPayload(): array
    {
        return [
            'client_name' => 'Jane Client',
            'email' => 'jane@example.com',
            'company' => 'Example Company',
            'service_type' => 'web_development',
            'budget_range' => '10k_25k',
            'message' => 'We need a new website for our growing business.',
            'website' => '',
        ];
    }
}
