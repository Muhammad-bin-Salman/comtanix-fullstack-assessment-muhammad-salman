<?php

namespace App\Actions;

use App\Enums\QuoteRequestStatus;
use App\Models\QuoteRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UpdateQuoteRequestStatus
{
    public function execute(
        QuoteRequest $quoteRequest,
        QuoteRequestStatus $targetStatus,
    ): QuoteRequest {
        return DB::transaction(function () use ($quoteRequest, $targetStatus) {
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
