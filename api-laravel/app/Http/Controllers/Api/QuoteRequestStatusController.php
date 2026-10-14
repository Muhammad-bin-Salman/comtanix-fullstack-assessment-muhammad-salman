<?php

namespace App\Http\Controllers\Api;

use App\Actions\UpdateQuoteRequestStatus;
use App\Enums\QuoteRequestStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateQuoteRequestStatusRequest;
use App\Http\Resources\QuoteRequestResource;
use App\Models\QuoteRequest;
use Illuminate\Support\Facades\Gate;

class QuoteRequestStatusController extends Controller
{
    public function __invoke(
        UpdateQuoteRequestStatusRequest $request,
        QuoteRequest $quoteRequest,
        UpdateQuoteRequestStatus $updateStatus,
    ): QuoteRequestResource {
        Gate::authorize('updateStatus', $quoteRequest);

        $targetStatus = QuoteRequestStatus::from($request->validated('status'));
        $updatedQuoteRequest = $updateStatus->execute(
            $quoteRequest,
            $targetStatus,
            (int) $request->user()->getKey(),
        );

        return new QuoteRequestResource($updatedQuoteRequest->load('assignedUser'));
    }
}
