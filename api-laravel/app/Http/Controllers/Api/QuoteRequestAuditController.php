<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ListQuoteAuditEventsRequest;
use App\Models\QuoteRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Http;
use Throwable;

class QuoteRequestAuditController extends Controller
{
    public function __invoke(
        ListQuoteAuditEventsRequest $request,
        QuoteRequest $quoteRequest,
    ): JsonResponse {
        Gate::authorize('view', $quoteRequest);

        $baseUrl = config('services.audit.url');

        if (! is_string($baseUrl) || $baseUrl === '') {
            return $this->unavailableResponse();
        }

        $query = array_filter([
            'quoteRequestId' => $quoteRequest->id,
            'page' => $request->integer('page', 1),
            'per_page' => $request->integer('per_page', 20),
            'type' => $request->validated('type'),
        ], fn (mixed $value): bool => $value !== null);

        try {
            $response = Http::acceptJson()
                ->timeout((int) config('services.audit.timeout', 5))
                ->get(rtrim($baseUrl, '/').'/events', $query)
                ->throw();
        } catch (Throwable) {
            return $this->unavailableResponse();
        }

        return response()->json([
            'data' => collect($response->json('data', []))->map(fn (array $event): array => [
                'eventId' => $event['eventId'] ?? null,
                'type' => $event['type'] ?? null,
                'quoteRequestId' => $event['quoteRequestId'] ?? null,
                'actorId' => $event['actorId'] ?? null,
                'data' => $event['data'] ?? [],
                'occurredAt' => $event['occurredAt'] ?? null,
            ])->values(),
            'meta' => [
                'page' => $response->json('meta.page', 1),
                'per_page' => $response->json('meta.per_page', 20),
                'total' => $response->json('meta.total', 0),
                'total_pages' => $response->json('meta.total_pages', 0),
            ],
        ]);
    }

    private function unavailableResponse(): JsonResponse
    {
        return response()->json([
            'message' => 'Audit history is temporarily unavailable.',
        ], 502);
    }
}
