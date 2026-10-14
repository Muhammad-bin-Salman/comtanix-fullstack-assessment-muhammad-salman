<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use JsonException;
use RuntimeException;
use Throwable;

class PublishAuditEvent implements ShouldQueue
{
    use Queueable;

    public int $tries = 7;

    /**
     * @param  array<string, mixed>  $payload
     */
    public function __construct(public array $payload) {}

    /**
     * @return list<int>
     */
    public function backoff(): array
    {
        return [10, 30, 60, 120, 300, 600];
    }

    /**
     * @throws JsonException
     */
    public function handle(): void
    {
        $baseUrl = config('services.audit.url');
        $sharedSecret = config('services.audit.shared_secret');

        if (! is_string($baseUrl) || trim($baseUrl) === '') {
            throw new RuntimeException('Audit service URL is not configured.');
        }

        if (! is_string($sharedSecret) || $sharedSecret === '') {
            throw new RuntimeException('Audit shared secret is not configured.');
        }

        $rawBody = json_encode(
            $this->payload,
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES,
        );
        $signature = hash_hmac('sha256', $rawBody, $sharedSecret);
        $timeout = max(1, (int) config('services.audit.timeout', 5));

        Http::acceptJson()
            ->timeout($timeout)
            ->withHeaders([
                'X-Signature' => $signature,
            ])
            ->withBody($rawBody, 'application/json')
            ->post(rtrim($baseUrl, '/').'/events')
            ->throw();
    }

    public function failed(Throwable $exception): void
    {
        Log::error('Audit event delivery permanently failed.', [
            'event_id' => $this->payload['eventId'] ?? null,
            'event_type' => $this->payload['type'] ?? null,
            'quote_request_id' => $this->payload['quoteRequestId'] ?? null,
            'exception' => $exception->getMessage(),
        ]);
    }
}
