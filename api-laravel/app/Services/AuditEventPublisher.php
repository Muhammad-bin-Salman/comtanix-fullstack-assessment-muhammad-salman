<?php

namespace App\Services;

use App\Jobs\PublishAuditEvent;
use Illuminate\Support\Str;

class AuditEventPublisher
{
    public const QUOTE_CREATED = 'quote.created';

    public const QUOTE_STATUS_CHANGED = 'quote.status_changed';

    public const QUOTE_ASSIGNED = 'quote.assigned';

    /**
     * @param  array<string, mixed>  $data
     */
    public function publish(
        string $type,
        int $quoteRequestId,
        ?int $actorId,
        array $data,
    ): void {
        PublishAuditEvent::dispatch([
            'eventId' => (string) Str::uuid(),
            'type' => $type,
            'quoteRequestId' => $quoteRequestId,
            'actorId' => $actorId,
            'data' => $data,
            'occurredAt' => now()->toISOString(),
        ])->afterCommit();
    }
}
