<?php

namespace App\Http\Requests;

use App\Enums\QuoteRequestStatus;
use App\Models\QuoteRequest;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListQuoteRequestsRequest extends FormRequest
{
    public const SORT_FIELDS = [
        'created_at',
        'updated_at',
        'client_name',
        'status',
    ];

    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'search' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', Rule::enum(QuoteRequestStatus::class)],
            'assigned_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'service_type' => ['nullable', 'string', Rule::in(QuoteRequest::SERVICE_TYPES)],
            'sort_by' => ['nullable', 'string', Rule::in(self::SORT_FIELDS)],
            'sort_direction' => ['nullable', 'string', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}
