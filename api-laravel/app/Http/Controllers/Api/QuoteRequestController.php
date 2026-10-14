<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ListQuoteRequestsRequest;
use App\Http\Resources\QuoteRequestResource;
use App\Models\QuoteRequest;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

class QuoteRequestController extends Controller
{
    public function index(ListQuoteRequestsRequest $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', QuoteRequest::class);

        $validated = $request->validated();

        $query = QuoteRequest::query()
            ->with('assignedUser')
            ->when($validated['search'] ?? null, function ($query, string $search) {
                $query->where(function ($query) use ($search) {
                    $query
                        ->where('client_name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('company', 'like', "%{$search}%");
                });
            })
            ->when($validated['status'] ?? null, function ($query, string $status) {
                $query->where('status', $status);
            })
            ->when($validated['assigned_user_id'] ?? null, function ($query, int $userId) {
                $query->where('assigned_user_id', $userId);
            })
            ->when($validated['service_type'] ?? null, function ($query, string $serviceType) {
                $query->where('service_type', $serviceType);
            });

        $sortBy = match ($validated['sort_by'] ?? 'created_at') {
            'updated_at' => 'updated_at',
            'client_name' => 'client_name',
            'status' => 'status',
            default => 'created_at',
        };
        $sortDirection = ($validated['sort_direction'] ?? 'desc') === 'asc' ? 'asc' : 'desc';
        $perPage = $validated['per_page'] ?? 15;

        return QuoteRequestResource::collection(
            $query
                ->orderBy($sortBy, $sortDirection)
                ->paginate($perPage)
                ->withQueryString()
        );
    }

    public function show(QuoteRequest $quoteRequest): QuoteRequestResource
    {
        Gate::authorize('view', $quoteRequest);

        return new QuoteRequestResource($quoteRequest->load('assignedUser'));
    }
}
