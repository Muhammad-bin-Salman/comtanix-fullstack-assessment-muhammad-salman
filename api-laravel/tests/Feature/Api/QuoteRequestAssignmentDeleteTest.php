<?php

namespace Tests\Feature\Api;

use App\Models\QuoteRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class QuoteRequestAssignmentDeleteTest extends TestCase
{
    use RefreshDatabase;

    public function test_unauthenticated_assignment_returns_unauthorized(): void
    {
        $quoteRequest = QuoteRequest::factory()->create();
        $staff = User::factory()->staff()->create();

        $this->patchJson($this->assignmentUrl($quoteRequest), [
            'assigned_user_id' => $staff->id,
        ])->assertUnauthorized();
    }

    public function test_admin_can_assign_an_unassigned_quote_request(): void
    {
        $this->authenticateAdmin();
        $staff = User::factory()->staff()->create();
        $quoteRequest = QuoteRequest::factory()->create();

        $this->patchJson($this->assignmentUrl($quoteRequest), [
            'assigned_user_id' => $staff->id,
        ])
            ->assertOk()
            ->assertJsonPath('data.assigned_user_id', $staff->id);
    }

    public function test_admin_can_reassign_a_quote_request_to_different_staff(): void
    {
        $this->authenticateAdmin();
        $staffA = User::factory()->staff()->create();
        $staffB = User::factory()->staff()->create();
        $quoteRequest = QuoteRequest::factory()->assignedTo($staffA)->create();

        $this->patchJson($this->assignmentUrl($quoteRequest), [
            'assigned_user_id' => $staffB->id,
        ])
            ->assertOk()
            ->assertJsonPath('data.assigned_user_id', $staffB->id);
    }

    public function test_staff_cannot_assign_quote_requests(): void
    {
        Sanctum::actingAs(User::factory()->staff()->create());
        $assignee = User::factory()->staff()->create();
        $quoteRequest = QuoteRequest::factory()->create();

        $this->patchJson($this->assignmentUrl($quoteRequest), [
            'assigned_user_id' => $assignee->id,
        ])->assertForbidden();
    }

    public function test_nonexistent_assignee_is_rejected(): void
    {
        $this->authenticateAdmin();
        $quoteRequest = QuoteRequest::factory()->create();

        $this->patchJson($this->assignmentUrl($quoteRequest), [
            'assigned_user_id' => 999999,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('assigned_user_id');
    }

    public function test_admin_user_cannot_be_selected_as_assignee(): void
    {
        $this->authenticateAdmin();
        $adminAssignee = User::factory()->admin()->create();
        $quoteRequest = QuoteRequest::factory()->create();

        $this->patchJson($this->assignmentUrl($quoteRequest), [
            'assigned_user_id' => $adminAssignee->id,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('assigned_user_id');
    }

    public function test_malformed_assignee_id_is_rejected(): void
    {
        $this->authenticateAdmin();
        $quoteRequest = QuoteRequest::factory()->create();

        $this->patchJson($this->assignmentUrl($quoteRequest), [
            'assigned_user_id' => 'not-an-id',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('assigned_user_id');
    }

    public function test_assignment_is_persisted(): void
    {
        $this->authenticateAdmin();
        $staff = User::factory()->staff()->create();
        $quoteRequest = QuoteRequest::factory()->create();

        $this->patchJson($this->assignmentUrl($quoteRequest), [
            'assigned_user_id' => $staff->id,
        ])->assertOk();

        $this->assertDatabaseHas('quote_requests', [
            'id' => $quoteRequest->id,
            'assigned_user_id' => $staff->id,
        ]);
    }

    public function test_assignment_response_includes_intentional_assignee_data(): void
    {
        $this->authenticateAdmin();
        $staff = User::factory()->staff()->create();
        $quoteRequest = QuoteRequest::factory()->create();

        $this->patchJson($this->assignmentUrl($quoteRequest), [
            'assigned_user_id' => $staff->id,
        ])
            ->assertOk()
            ->assertJsonPath('data.assigned_user.id', $staff->id)
            ->assertJsonPath('data.assigned_user.name', $staff->name)
            ->assertJsonPath('data.assigned_user.email', $staff->email)
            ->assertJsonPath('data.assigned_user.role', User::ROLE_STAFF)
            ->assertJsonMissingPath('data.assigned_user.password')
            ->assertJsonMissingPath('data.assigned_user.remember_token');
    }

    public function test_same_assignment_is_idempotent(): void
    {
        $this->authenticateAdmin();
        $staff = User::factory()->staff()->create();
        $quoteRequest = QuoteRequest::factory()->assignedTo($staff)->create();
        $originalUpdatedAt = $quoteRequest->updated_at;

        $this->patchJson($this->assignmentUrl($quoteRequest), [
            'assigned_user_id' => $staff->id,
        ])
            ->assertOk()
            ->assertJsonPath('data.assigned_user_id', $staff->id);

        $this->assertTrue($quoteRequest->fresh()->updated_at->equalTo($originalUpdatedAt));
    }

    public function test_soft_deleted_quote_request_cannot_be_assigned(): void
    {
        $this->authenticateAdmin();
        $staff = User::factory()->staff()->create();
        $quoteRequest = QuoteRequest::factory()->create();
        $quoteRequest->delete();

        $this->patchJson($this->assignmentUrl($quoteRequest), [
            'assigned_user_id' => $staff->id,
        ])->assertNotFound();
    }

    public function test_unauthenticated_delete_returns_unauthorized(): void
    {
        $quoteRequest = QuoteRequest::factory()->create();

        $this->deleteJson($this->deletionUrl($quoteRequest))->assertUnauthorized();
    }

    public function test_admin_can_soft_delete_a_quote_request(): void
    {
        $this->authenticateAdmin();
        $quoteRequest = QuoteRequest::factory()->create();
        $quoteRequestId = $quoteRequest->id;

        $this->deleteJson($this->deletionUrl($quoteRequest))->assertNoContent();

        $this->assertSoftDeleted('quote_requests', ['id' => $quoteRequestId]);
        $this->assertNull(QuoteRequest::find($quoteRequestId));
        $this->assertNotNull(QuoteRequest::withTrashed()->find($quoteRequestId));
    }

    public function test_staff_cannot_delete_a_quote_request(): void
    {
        Sanctum::actingAs(User::factory()->staff()->create());
        $quoteRequest = QuoteRequest::factory()->create();

        $this->deleteJson($this->deletionUrl($quoteRequest))->assertForbidden();

        $this->assertNotNull(QuoteRequest::find($quoteRequest->id));
    }

    public function test_deleting_an_already_soft_deleted_quote_returns_not_found(): void
    {
        $this->authenticateAdmin();
        $quoteRequest = QuoteRequest::factory()->create();
        $quoteRequest->delete();

        $this->deleteJson($this->deletionUrl($quoteRequest))->assertNotFound();
    }

    private function authenticateAdmin(): User
    {
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        return $admin;
    }

    private function assignmentUrl(QuoteRequest $quoteRequest): string
    {
        return "/api/quote-requests/{$quoteRequest->id}/assign";
    }

    private function deletionUrl(QuoteRequest $quoteRequest): string
    {
        return "/api/quote-requests/{$quoteRequest->id}";
    }
}
