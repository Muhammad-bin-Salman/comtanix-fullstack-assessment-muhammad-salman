<?php

namespace App\Actions;

use App\Enums\QuoteRequestStatus;
use App\Models\QuoteRequest;
use App\Services\AuditEventPublisher;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UpdateQuoteRequestStatus
{
    public function __construct(private AuditEventPublisher $auditEvents) {}

    public function execute(
        QuoteRequest $quoteRequest,
        QuoteRequestStatus $targetStatus,
        int $actorId,
    ): QuoteRequest {
        return DB::transaction(function () use ($quoteRequest, $targetStatus, $actorId) {
            $persistedQuoteRequest = QuoteRequest::query()
                ->lockForUpdate()
                ->findOrFail($quoteRequest->getKey());

            $currentStatus = $persistedQuoteRequest->status;

            if (! in_array($targetStatus, $this->allowedTransitionsFrom($currentStatus), true)) {
                throw ValidationException::withMessages([
                    'status' => [sprintf(
                        'Cannot change quote status from %s to %s.',
                        $currentStatus->value,
                        $targetStatus->value,
                    )],
                ]);
            }

            $persistedQuoteRequest->update([
                'status' => $targetStatus,
            ]);

            $this->auditEvents->publish(
                type: AuditEventPublisher::QUOTE_STATUS_CHANGED,
                quoteRequestId: $persistedQuoteRequest->id,
                actorId: $actorId,
                data: [
                    'from' => $currentStatus->value,
                    'to' => $targetStatus->value,
                ],
            );

            return $persistedQuoteRequest;
        });
    }

    /**
     * @return list<QuoteRequestStatus>
     */
    private function allowedTransitionsFrom(QuoteRequestStatus $currentStatus): array
    {
        return match ($currentStatus) {
            QuoteRequestStatus::New => [QuoteRequestStatus::InReview],
            QuoteRequestStatus::InReview => [
                QuoteRequestStatus::Quoted,
                QuoteRequestStatus::Closed,
            ],
            QuoteRequestStatus::Quoted => [QuoteRequestStatus::Closed],
            QuoteRequestStatus::Closed => [],
        };
    }
}
