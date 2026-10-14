<?php

namespace Database\Factories;

use App\Enums\QuoteRequestStatus;
use App\Models\QuoteRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<QuoteRequest>
 */
class QuoteRequestFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'client_name' => fake()->name(),
            'email' => fake()->safeEmail(),
            'company' => fake()->optional()->company(),
            'service_type' => fake()->randomElement(QuoteRequest::SERVICE_TYPES),
            'budget_range' => fake()->optional()->randomElement(QuoteRequest::BUDGET_RANGES),
            'message' => fake()->paragraphs(2, true),
            'status' => QuoteRequestStatus::New,
            'assigned_user_id' => null,
        ];
    }

    public function inReview(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => QuoteRequestStatus::InReview,
        ]);
    }

    public function quoted(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => QuoteRequestStatus::Quoted,
        ]);
    }

    public function closed(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => QuoteRequestStatus::Closed,
        ]);
    }

    public function assignedTo(User $user): static
    {
        return $this->state(fn (array $attributes) => [
            'assigned_user_id' => $user->getKey(),
        ]);
    }
}
