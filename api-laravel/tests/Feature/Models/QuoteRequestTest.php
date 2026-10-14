<?php

namespace Tests\Feature\Models;

use App\Enums\QuoteRequestStatus;
use App\Models\QuoteRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class QuoteRequestTest extends TestCase
{
    use RefreshDatabase;

    public function test_factory_creates_an_unassigned_new_quote_request_by_default(): void
    {
        $quoteRequest = QuoteRequest::factory()->create();

        $this->assertSame(QuoteRequestStatus::New, $quoteRequest->status);
        $this->assertNull($quoteRequest->assigned_user_id);
        $this->assertDatabaseHas('quote_requests', [
            'id' => $quoteRequest->id,
            'status' => QuoteRequestStatus::New->value,
            'assigned_user_id' => null,
        ]);
    }

    public function test_status_is_cast_to_the_quote_request_status_enum(): void
    {
        $quoteRequest = QuoteRequest::factory()->quoted()->create();

        $this->assertInstanceOf(QuoteRequestStatus::class, $quoteRequest->status);
        $this->assertSame(QuoteRequestStatus::Quoted, $quoteRequest->status);
    }

    public function test_assigned_user_relationship_returns_the_assignee(): void
    {
        $user = User::factory()->create();
        $quoteRequest = QuoteRequest::factory()->assignedTo($user)->create();

        $this->assertTrue($quoteRequest->assignedUser->is($user));
    }

    public function test_user_relationship_returns_assigned_quote_requests(): void
    {
        $user = User::factory()->create();
        $assignedQuoteRequest = QuoteRequest::factory()->assignedTo($user)->create();
        QuoteRequest::factory()->create();

        $this->assertCount(1, $user->assignedQuoteRequests);
        $this->assertTrue($user->assignedQuoteRequests->first()->is($assignedQuoteRequest));
    }

    public function test_soft_deleted_quote_request_is_excluded_from_normal_queries(): void
    {
        $quoteRequest = QuoteRequest::factory()->create();

        $quoteRequest->delete();

        $this->assertNull(QuoteRequest::find($quoteRequest->id));
        $this->assertTrue(QuoteRequest::withTrashed()->findOrFail($quoteRequest->id)->trashed());
        $this->assertSoftDeleted($quoteRequest);
    }
}
