<?php

namespace App\Http\Requests;

use App\Services\AuditEventPublisher;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListQuoteAuditEventsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'type' => [
                'sometimes',
                'string',
                Rule::in([
                    AuditEventPublisher::QUOTE_CREATED,
                    AuditEventPublisher::QUOTE_STATUS_CHANGED,
                    AuditEventPublisher::QUOTE_ASSIGNED,
                ]),
            ],
        ];
    }
}
