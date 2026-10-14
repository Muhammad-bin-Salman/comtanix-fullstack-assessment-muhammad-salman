<?php

namespace App\Actions;

use App\Models\QuoteRequest;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class AssignQuoteRequest
{
    public function execute(QuoteRequest $quoteRequest, User $assignee): QuoteRequest
    {
        return DB::transaction(function () use ($quoteRequest, $assignee) {
            $persistedQuoteRequest = QuoteRequest::query()
                ->lockForUpdate()
                ->findOrFail($quoteRequest->getKey());

            if ($persistedQuoteRequest->assigned_user_id !== $assignee->getKey()) {
                $persistedQuoteRequest->update([
                    'assigned_user_id' => $assignee->getKey(),
                ]);
            }

            return $persistedQuoteRequest;
        });
    }
}
