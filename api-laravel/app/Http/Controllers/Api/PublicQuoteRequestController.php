<?php

namespace App\Http\Controllers\Api;

use App\Enums\QuoteRequestStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StorePublicQuoteRequest;
use App\Http\Resources\QuoteRequestResource;
use App\Models\QuoteRequest;
use Illuminate\Http\JsonResponse;

class PublicQuoteRequestController extends Controller
{
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

        return (new QuoteRequestResource($quoteRequest))
            ->response()
            ->setStatusCode(201);
    }
}
