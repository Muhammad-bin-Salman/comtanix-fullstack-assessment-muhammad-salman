<?php

namespace App\Actions;

use App\Models\QuoteRequest;
use App\Models\User;
use App\Services\AuditEventPublisher;
use Illuminate\Support\Facades\DB;

class AssignQuoteRequest
{
    public function __construct(private AuditEventPublisher $auditEvents) {}

    public function execute(
        QuoteRequest $quoteRequest,
        User $assignee,
        int $actorId,
    ): QuoteRequest {
        return DB::transaction(function () use ($quoteRequest, $assignee, $actorId) {
            $persistedQuoteRequest = QuoteRequest::query()
                ->lockForUpdate()
                ->findOrFail($quoteRequest->getKey());

            if ($persistedQuoteRequest->assigned_user_id !== $assignee->getKey()) {
                $previousAssigneeId = $persistedQuoteRequest->assigned_user_id;

                $persistedQuoteRequest->update([
                    'assigned_user_id' => $assignee->getKey(),
                ]);

                $this->auditEvents->publish(
                    type: AuditEventPublisher::QUOTE_ASSIGNED,
                    quoteRequestId: $persistedQuoteRequest->id,
                    actorId: $actorId,
                    data: [
                        'from' => $previousAssigneeId,
                        'to' => $assignee->getKey(),
                    ],
                );
            }

            return $persistedQuoteRequest;
        });
    }
}
