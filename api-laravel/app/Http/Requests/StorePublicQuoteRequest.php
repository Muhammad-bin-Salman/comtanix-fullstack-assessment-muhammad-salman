<?php

namespace App\Http\Requests;

use App\Models\QuoteRequest;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePublicQuoteRequest extends FormRequest
{
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
            'client_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'company' => ['nullable', 'string', 'max:255'],
            'service_type' => ['required', 'string', Rule::in(QuoteRequest::SERVICE_TYPES)],
            'budget_range' => ['nullable', 'string', Rule::in(QuoteRequest::BUDGET_RANGES)],
            'message' => ['required', 'string', 'min:10', 'max:5000'],
            'website' => ['nullable', 'string', 'max:255', 'prohibited'],
            'status' => ['prohibited'],
            'assigned_user_id' => ['prohibited'],
            'deleted_at' => ['prohibited'],
        ];
    }
}
