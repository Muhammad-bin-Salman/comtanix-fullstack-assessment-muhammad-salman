<?php

namespace Database\Seeders;

use App\Enums\QuoteRequestStatus;
use App\Models\QuoteRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Database\Eloquent\Factories\Sequence;
use Illuminate\Database\Seeder;

class QuoteRequestSeeder extends Seeder
{
    public function run(): void
    {
        $currentCount = QuoteRequest::query()->count();

        if ($currentCount >= 200) {
            return;
        }

        $staffOne = User::query()->where('email', 'staff1@comtanix.test')->firstOrFail();
        $staffTwo = User::query()->where('email', 'staff2@comtanix.test')->firstOrFail();

        if ($currentCount > 0) {
            $this->createMixedTopUpQuotes(200 - $currentCount, $staffOne, $staffTwo);

            return;
        }

        $this->createCleanDatabaseDistribution($staffOne, $staffTwo);
    }

    private function createCleanDatabaseDistribution(User $staffOne, User $staffTwo): void
    {
        $this->createQuotes(QuoteRequest::factory(), 30);
        $this->createQuotes(QuoteRequest::factory()->assignedTo($staffOne), 10);
        $this->createQuotes(QuoteRequest::factory()->assignedTo($staffTwo), 10);

        $this->createQuotes(QuoteRequest::factory()->inReview(), 10);
        $this->createQuotes(QuoteRequest::factory()->inReview()->assignedTo($staffOne), 25);
        $this->createQuotes(QuoteRequest::factory()->inReview()->assignedTo($staffTwo), 25);

        $this->createQuotes(QuoteRequest::factory()->quoted()->assignedTo($staffOne), 25);
        $this->createQuotes(QuoteRequest::factory()->quoted()->assignedTo($staffTwo), 25);

        $this->createQuotes(QuoteRequest::factory()->closed(), 10);
        $this->createQuotes(QuoteRequest::factory()->closed()->assignedTo($staffOne), 15);
        $this->createQuotes(QuoteRequest::factory()->closed()->assignedTo($staffTwo), 15);
    }

    private function createMixedTopUpQuotes(int $count, User $staffOne, User $staffTwo): void
    {
        $statuses = [
            QuoteRequestStatus::New,
            QuoteRequestStatus::InReview,
            QuoteRequestStatus::Quoted,
            QuoteRequestStatus::Closed,
        ];
        $assigneeIds = [null, $staffOne->getKey(), $staffTwo->getKey()];

        QuoteRequest::factory()
            ->count($count)
            ->state(new Sequence(
                fn (Sequence $sequence) => [
                    'status' => $statuses[$sequence->index % count($statuses)],
                    'assigned_user_id' => $assigneeIds[$sequence->index % count($assigneeIds)],
                ],
            ))
            ->create();
    }

    /**
     * @param  Factory<QuoteRequest>  $factory
     */
    private function createQuotes(Factory $factory, int $count): void
    {
        $factory->count($count)->create();
    }
}
