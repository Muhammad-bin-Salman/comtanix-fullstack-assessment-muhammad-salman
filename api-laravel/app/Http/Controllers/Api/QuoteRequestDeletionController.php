<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\QuoteRequest;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class QuoteRequestDeletionController extends Controller
{
    public function __invoke(QuoteRequest $quoteRequest): Response
    {
        Gate::authorize('delete', $quoteRequest);

        $quoteRequest->delete();

        return response()->noContent();
    }
}
