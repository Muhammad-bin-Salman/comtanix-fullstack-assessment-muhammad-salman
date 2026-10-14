<?php

namespace App\Http\Controllers\Api;

use App\Actions\AssignQuoteRequest;
use App\Http\Controllers\Controller;
use App\Http\Requests\AssignQuoteRequest as AssignQuoteRequestRequest;
use App\Http\Resources\QuoteRequestResource;
use App\Models\QuoteRequest;
use App\Models\User;
use Illuminate\Support\Facades\Gate;

class QuoteRequestAssignmentController extends Controller
{
    public function __invoke(
        AssignQuoteRequestRequest $request,
        QuoteRequest $quoteRequest,
        AssignQuoteRequest $assignQuoteRequest,
    ): QuoteRequestResource {
        Gate::authorize('assign', $quoteRequest);

        $assignee = User::findOrFail($request->validated('assigned_user_id'));
        $updatedQuoteRequest = $assignQuoteRequest->execute(
            $quoteRequest,
            $assignee,
            (int) $request->user()->getKey(),
        );

        return new QuoteRequestResource($updatedQuoteRequest->load('assignedUser'));
    }
}
