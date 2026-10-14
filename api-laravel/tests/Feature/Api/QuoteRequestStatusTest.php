<?php

namespace Tests\Feature\Api;

use App\Enums\QuoteRequestStatus;
use App\Models\QuoteRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class QuoteRequestStatusTest extends TestCase
{
    use RefreshDatabase;

    public function test_unauthenticated_user_receives_unauthorized_response(): void
    {
        $quoteRequest = QuoteRequest::factory()->create();

        $this->patchJson($this->statusUrl($quoteRequest), [
            'status' => QuoteRequestStatus::InReview->value,
        ])->assertUnauthorized();
    }

    public function test_admin_can_update_any_quote_request(): void
    {
        $this->authenticate(User::factory()->admin()->create());
        $quoteRequest = QuoteRequest::factory()->create();

        $this->patchJson($this->statusUrl($quoteRequest), [
            'status' => QuoteRequestStatus::InReview->value,
        ])->assertOk();
    }

    public function test_assigned_staff_can_update_their_quote_request(): void
    {
        $staff = User::factory()->staff()->create();
        $this->authenticate($staff);
        $quoteRequest = QuoteRequest::factory()->assignedTo($staff)->create();

        $this->patchJson($this->statusUrl($quoteRequest), [
            'status' => QuoteRequestStatus::InReview->value,
        ])->assertOk();
    }

    public function test_staff_cannot_update_another_staff_users_quote_request(): void
    {
        $staff = User::factory()->staff()->create();
        $otherStaff = User::factory()->staff()->create();
        $this->authenticate($staff);
        $quoteRequest = QuoteRequest::factory()->assignedTo($otherStaff)->create();

        $this->patchJson($this->statusUrl($quoteRequest), [
            'status' => QuoteRequestStatus::InReview->value,
        ])->assertForbidden();
    }

    public function test_staff_cannot_update_an_unassigned_quote_request(): void
    {
        $this->authenticate(User::factory()->staff()->create());
        $quoteRequest = QuoteRequest::factory()->create();

        $this->patchJson($this->statusUrl($quoteRequest), [
            'status' => QuoteRequestStatus::InReview->value,
        ])->assertForbidden();
    }

    #[DataProvider('validTransitionProvider')]
    public function test_valid_status_transitions_succeed(
        QuoteRequestStatus $currentStatus,
        QuoteRequestStatus $targetStatus,
    ): void {
        $this->authenticate(User::factory()->admin()->create());
        $quoteRequest = QuoteRequest::factory()->create(['status' => $currentStatus]);

        $this->patchJson($this->statusUrl($quoteRequest), [
            'status' => $targetStatus->value,
        ])
            ->assertOk()
            ->assertJsonPath('data.status', $targetStatus->value);
    }

    /**
     * @return array<string, array{QuoteRequestStatus, QuoteRequestStatus}>
     */
    public static function validTransitionProvider(): array
    {
        return [
            'new to in review' => [QuoteRequestStatus::New, QuoteRequestStatus::InReview],
            'in review to quoted' => [QuoteRequestStatus::InReview, QuoteRequestStatus::Quoted],
            'in review to closed' => [QuoteRequestStatus::InReview, QuoteRequestStatus::Closed],
            'quoted to closed' => [QuoteRequestStatus::Quoted, QuoteRequestStatus::Closed],
        ];
    }

    #[DataProvider('invalidTransitionProvider')]
    public function test_invalid_status_transitions_are_rejected(
        QuoteRequestStatus $currentStatus,
        QuoteRequestStatus $targetStatus,
    ): void {
        $this->authenticate(User::factory()->admin()->create());
        $quoteRequest = QuoteRequest::factory()->create(['status' => $currentStatus]);

        $this->patchJson($this->statusUrl($quoteRequest), [
            'status' => $targetStatus->value,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status')
            ->assertJsonPath(
                'errors.status.0',
                "Cannot change quote status from {$currentStatus->value} to {$targetStatus->value}.",
            );
    }

    /**
     * @return array<string, array{QuoteRequestStatus, QuoteRequestStatus}>
     */
    public static function invalidTransitionProvider(): array
    {
        return [
            'new to quoted' => [QuoteRequestStatus::New, QuoteRequestStatus::Quoted],
            'new to closed' => [QuoteRequestStatus::New, QuoteRequestStatus::Closed],
            'quoted to in review' => [QuoteRequestStatus::Quoted, QuoteRequestStatus::InReview],
            'closed to new' => [QuoteRequestStatus::Closed, QuoteRequestStatus::New],
            'closed to in review' => [QuoteRequestStatus::Closed, QuoteRequestStatus::InReview],
            'closed to quoted' => [QuoteRequestStatus::Closed, QuoteRequestStatus::Quoted],
            'same new status' => [QuoteRequestStatus::New, QuoteRequestStatus::New],
            'same in review status' => [QuoteRequestStatus::InReview, QuoteRequestStatus::InReview],
            'same quoted status' => [QuoteRequestStatus::Quoted, QuoteRequestStatus::Quoted],
            'same closed status' => [QuoteRequestStatus::Closed, QuoteRequestStatus::Closed],
        ];
    }

    public function test_assigned_staff_passes_authorization_but_invalid_transition_is_rejected(): void
    {
        $staff = User::factory()->staff()->create();
        $this->authenticate($staff);
        $quoteRequest = QuoteRequest::factory()->assignedTo($staff)->create();

        $this->patchJson($this->statusUrl($quoteRequest), [
            'status' => QuoteRequestStatus::Quoted->value,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');
    }

    public function test_unknown_status_value_is_rejected(): void
    {
        $this->authenticate(User::factory()->admin()->create());
        $quoteRequest = QuoteRequest::factory()->create();

        $this->patchJson($this->statusUrl($quoteRequest), [
            'status' => 'pending_approval',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');
    }

    public function test_valid_status_update_is_persisted(): void
    {
        $this->authenticate(User::factory()->admin()->create());
        $quoteRequest = QuoteRequest::factory()->create();

        $this->patchJson($this->statusUrl($quoteRequest), [
            'status' => QuoteRequestStatus::InReview->value,
        ])->assertOk();

        $this->assertDatabaseHas('quote_requests', [
            'id' => $quoteRequest->id,
            'status' => QuoteRequestStatus::InReview->value,
        ]);
    }

    public function test_invalid_transition_does_not_change_persisted_status(): void
    {
        $this->authenticate(User::factory()->admin()->create());
        $quoteRequest = QuoteRequest::factory()->create();

        $this->patchJson($this->statusUrl($quoteRequest), [
            'status' => QuoteRequestStatus::Closed->value,
        ])->assertUnprocessable();

        $this->assertDatabaseHas('quote_requests', [
            'id' => $quoteRequest->id,
            'status' => QuoteRequestStatus::New->value,
        ]);
    }

    public function test_soft_deleted_quote_request_cannot_be_updated(): void
    {
        $this->authenticate(User::factory()->admin()->create());
        $quoteRequest = QuoteRequest::factory()->create();
        $quoteRequest->delete();

        $this->patchJson($this->statusUrl($quoteRequest), [
            'status' => QuoteRequestStatus::InReview->value,
        ])->assertNotFound();
    }

    private function authenticate(User $user): void
    {
        Sanctum::actingAs($user);
    }

    private function statusUrl(QuoteRequest $quoteRequest): string
    {
        return "/api/quote-requests/{$quoteRequest->id}/status";
    }
}
