<?php

namespace App\Http\Controllers\Api;

use App\Enums\QuoteRequestStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StorePublicQuoteRequest;
use App\Http\Resources\QuoteRequestResource;
use App\Models\QuoteRequest;
use App\Services\AuditEventPublisher;
use Illuminate\Http\JsonResponse;

class PublicQuoteRequestController extends Controller
{
    public function __construct(private AuditEventPublisher $auditEvents) {}

    public function __invoke(StorePublicQuoteRequest $request): JsonResponse
    {
        $quoteRequest = QuoteRequest::create([
            ...$request->safe()->only([
                'client_name',
                'email',
                'company',
                'service_type',
                'budget_range',
                'message',
            ]),
            'status' => QuoteRequestStatus::New,
            'assigned_user_id' => null,
        ]);

        $this->auditEvents->publish(
            type: AuditEventPublisher::QUOTE_CREATED,
            quoteRequestId: $quoteRequest->id,
            actorId: null,
            data: ['status' => QuoteRequestStatus::New->value],
        );

        return (new QuoteRequestResource($quoteRequest))
            ->response()
            ->setStatusCode(201);
    }
}
