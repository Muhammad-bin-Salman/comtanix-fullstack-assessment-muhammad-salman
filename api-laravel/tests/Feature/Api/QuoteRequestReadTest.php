<?php

namespace Tests\Feature\Api;

use App\Enums\QuoteRequestStatus;
use App\Models\QuoteRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class QuoteRequestReadTest extends TestCase
{
    use RefreshDatabase;

    public function test_unauthenticated_user_cannot_list_quote_requests(): void
    {
        $this->get('/api/quote-requests')
            ->assertUnauthorized()
            ->assertHeader('content-type', 'application/json')
            ->assertExactJson([
                'message' => 'Unauthenticated.',
            ]);
    }

    public function test_authenticated_staff_can_list_quote_requests(): void
    {
        $this->authenticateStaff();
        QuoteRequest::factory()->count(2)->create();

        $this->getJson('/api/quote-requests')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_list_is_paginated(): void
    {
        $this->authenticateStaff();
        QuoteRequest::factory()->count(8)->create();

        $this->getJson('/api/quote-requests?per_page=3')
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('meta.per_page', 3)
            ->assertJsonPath('meta.total', 8)
            ->assertJsonStructure(['links', 'meta']);
    }

    public function test_list_can_search_by_client_name(): void
    {
        $this->authenticateStaff();
        QuoteRequest::factory()->create(['client_name' => 'Unique Client Name']);
        QuoteRequest::factory()->create(['client_name' => 'Someone Else']);

        $this->getJson('/api/quote-requests?search=Unique')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.client_name', 'Unique Client Name');
    }

    public function test_list_can_filter_by_status(): void
    {
        $this->authenticateStaff();
        QuoteRequest::factory()->inReview()->create();
        QuoteRequest::factory()->quoted()->create();

        $this->getJson('/api/quote-requests?status=in_review')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.status', QuoteRequestStatus::InReview->value);
    }

    public function test_list_can_filter_by_assigned_user(): void
    {
        $this->authenticateStaff();
        $assignee = User::factory()->staff()->create();
        QuoteRequest::factory()->assignedTo($assignee)->create();
        QuoteRequest::factory()->create();

        $this->getJson("/api/quote-requests?assigned_user_id={$assignee->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.assigned_user_id', $assignee->id);
    }

    public function test_list_can_filter_by_service_type(): void
    {
        $this->authenticateStaff();
        QuoteRequest::factory()->create(['service_type' => 'crm']);
        QuoteRequest::factory()->create(['service_type' => 'ecommerce']);

        $this->getJson('/api/quote-requests?service_type=crm')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.service_type', 'crm');
    }

    public function test_list_can_sort_by_an_allowed_field(): void
    {
        $this->authenticateStaff();
        QuoteRequest::factory()->create(['client_name' => 'Zulu Client']);
        QuoteRequest::factory()->create(['client_name' => 'Alpha Client']);

        $this->getJson('/api/quote-requests?sort_by=client_name&sort_direction=asc')
            ->assertOk()
            ->assertJsonPath('data.0.client_name', 'Alpha Client')
            ->assertJsonPath('data.1.client_name', 'Zulu Client');
    }

    public function test_invalid_sort_field_is_rejected(): void
    {
        $this->authenticateStaff();

        $this->getJson('/api/quote-requests?sort_by=assigned_user_id')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('sort_by');
    }

    public function test_invalid_sort_direction_is_rejected(): void
    {
        $this->authenticateStaff();

        $this->getJson('/api/quote-requests?sort_direction=sideways')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('sort_direction');
    }

    public function test_per_page_is_bounded(): void
    {
        $this->authenticateStaff();

        $this->getJson('/api/quote-requests?per_page=101')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('per_page');
    }

    public function test_list_includes_intentional_assigned_user_data(): void
    {
        $this->authenticateStaff();
        $assignee = User::factory()->staff()->create();
        QuoteRequest::factory()->assignedTo($assignee)->create();

        $this->getJson('/api/quote-requests')
            ->assertOk()
            ->assertJsonPath('data.0.assigned_user.id', $assignee->id)
            ->assertJsonPath('data.0.assigned_user.email', $assignee->email)
            ->assertJsonMissingPath('data.0.assigned_user.password')
            ->assertJsonMissingPath('data.0.assigned_user.remember_token');
    }

    public function test_authenticated_staff_can_view_quote_request_detail(): void
    {
        $this->authenticateStaff();
        $assignee = User::factory()->staff()->create();
        $quoteRequest = QuoteRequest::factory()->assignedTo($assignee)->create();

        $this->getJson("/api/quote-requests/{$quoteRequest->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $quoteRequest->id)
            ->assertJsonPath('data.assigned_user.id', $assignee->id);
    }

    public function test_unauthenticated_user_cannot_view_quote_request_detail(): void
    {
        $quoteRequest = QuoteRequest::factory()->create();

        $this->getJson("/api/quote-requests/{$quoteRequest->id}")
            ->assertUnauthorized();
    }

    public function test_soft_deleted_quote_request_is_not_returned(): void
    {
        $this->authenticateStaff();
        $quoteRequest = QuoteRequest::factory()->create();
        $quoteRequest->delete();

        $this->getJson("/api/quote-requests/{$quoteRequest->id}")
            ->assertNotFound();
    }

    public function test_multiple_filters_can_be_combined(): void
    {
        $this->authenticateStaff();
        $assignee = User::factory()->staff()->create();

        QuoteRequest::factory()
            ->inReview()
            ->assignedTo($assignee)
            ->create([
                'client_name' => 'Combined Match',
                'service_type' => 'crm',
            ]);
        QuoteRequest::factory()->inReview()->assignedTo($assignee)->create([
            'client_name' => 'Wrong Service',
            'service_type' => 'ecommerce',
        ]);

        $query = http_build_query([
            'search' => 'Combined',
            'status' => QuoteRequestStatus::InReview->value,
            'assigned_user_id' => $assignee->id,
            'service_type' => 'crm',
        ]);

        $this->getJson("/api/quote-requests?{$query}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.client_name', 'Combined Match');
    }

    private function authenticateStaff(): User
    {
        $staff = User::factory()->staff()->create();
        Sanctum::actingAs($staff);

        return $staff;
    }
}
