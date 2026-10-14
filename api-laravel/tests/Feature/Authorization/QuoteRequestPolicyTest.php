<?php

namespace Tests\Feature\Authorization;

use App\Models\QuoteRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class QuoteRequestPolicyTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_view_any_quote_request(): void
    {
        $admin = User::factory()->admin()->create();

        $this->assertTrue($admin->can('viewAny', QuoteRequest::class));
    }

    public function test_staff_can_view_quote_requests(): void
    {
        $staff = User::factory()->staff()->create();
        $quoteRequest = QuoteRequest::factory()->create();

        $this->assertTrue($staff->can('viewAny', QuoteRequest::class));
        $this->assertTrue($staff->can('view', $quoteRequest));
    }

    public function test_admin_can_update_quote_status(): void
    {
        $admin = User::factory()->admin()->create();
        $quoteRequest = QuoteRequest::factory()->create();

        $this->assertTrue($admin->can('updateStatus', $quoteRequest));
    }

    public function test_assigned_staff_can_update_their_quote_status(): void
    {
        $staff = User::factory()->staff()->create();
        $quoteRequest = QuoteRequest::factory()->assignedTo($staff)->create();

        $this->assertTrue($staff->can('updateStatus', $quoteRequest));
    }

    public function test_staff_cannot_update_another_staff_members_quote_status(): void
    {
        $staff = User::factory()->staff()->create();
        $otherStaff = User::factory()->staff()->create();
        $quoteRequest = QuoteRequest::factory()->assignedTo($otherStaff)->create();

        $this->assertFalse($staff->can('updateStatus', $quoteRequest));
    }

    public function test_staff_cannot_update_an_unassigned_quote_status(): void
    {
        $staff = User::factory()->staff()->create();
        $quoteRequest = QuoteRequest::factory()->create();

        $this->assertFalse($staff->can('updateStatus', $quoteRequest));
    }

    public function test_admin_can_assign_or_reassign_quote_requests(): void
    {
        $admin = User::factory()->admin()->create();
        $quoteRequest = QuoteRequest::factory()->create();

        $this->assertTrue($admin->can('assign', $quoteRequest));
    }

    public function test_staff_cannot_assign_or_reassign_quote_requests(): void
    {
        $staff = User::factory()->staff()->create();
        $quoteRequest = QuoteRequest::factory()->assignedTo($staff)->create();

        $this->assertFalse($staff->can('assign', $quoteRequest));
    }

    public function test_admin_can_delete_quote_requests(): void
    {
        $admin = User::factory()->admin()->create();
        $quoteRequest = QuoteRequest::factory()->create();

        $this->assertTrue($admin->can('delete', $quoteRequest));
    }

    public function test_staff_cannot_delete_quote_requests(): void
    {
        $staff = User::factory()->staff()->create();
        $quoteRequest = QuoteRequest::factory()->assignedTo($staff)->create();

        $this->assertFalse($staff->can('delete', $quoteRequest));
    }
}
