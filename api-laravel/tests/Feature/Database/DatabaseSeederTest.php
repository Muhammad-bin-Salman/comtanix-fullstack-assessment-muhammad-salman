<?php

namespace Tests\Feature\Database;

use App\Enums\QuoteRequestStatus;
use App\Jobs\PublishAuditEvent;
use App\Models\QuoteRequest;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class DatabaseSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_seeds_required_users_and_quote_distribution_without_audit_jobs(): void
    {
        Queue::fake();

        $this->seed(DatabaseSeeder::class);

        $admin = User::query()->where('email', 'admin@comtanix.test')->firstOrFail();
        $staffOne = User::query()->where('email', 'staff1@comtanix.test')->firstOrFail();
        $staffTwo = User::query()->where('email', 'staff2@comtanix.test')->firstOrFail();

        $this->assertSame('Assessment Admin', $admin->name);
        $this->assertSame(User::ROLE_ADMIN, $admin->role);
        $this->assertSame('Staff One', $staffOne->name);
        $this->assertSame(User::ROLE_STAFF, $staffOne->role);
        $this->assertSame('Staff Two', $staffTwo->name);
        $this->assertSame(User::ROLE_STAFF, $staffTwo->role);
        $this->assertTrue(Hash::check('Password123!', $admin->password));
        $this->assertTrue(Hash::check('Password123!', $staffOne->password));
        $this->assertTrue(Hash::check('Password123!', $staffTwo->password));

        $this->assertSame(200, QuoteRequest::query()->count());
        $this->assertStatusCount(QuoteRequestStatus::New, 50);
        $this->assertStatusCount(QuoteRequestStatus::InReview, 60);
        $this->assertStatusCount(QuoteRequestStatus::Quoted, 50);
        $this->assertStatusCount(QuoteRequestStatus::Closed, 40);
        $this->assertSame(75, QuoteRequest::query()->whereBelongsTo($staffOne, 'assignedUser')->count());
        $this->assertSame(75, QuoteRequest::query()->whereBelongsTo($staffTwo, 'assignedUser')->count());
        $this->assertSame(50, QuoteRequest::query()->whereNull('assigned_user_id')->count());
        $this->assertSame(
            0,
            QuoteRequest::query()
                ->whereNotNull('assigned_user_id')
                ->whereHas('assignedUser', fn ($query) => $query->where('role', '!=', User::ROLE_STAFF))
                ->count(),
        );
        Queue::assertNotPushed(PublishAuditEvent::class);
    }

    public function test_running_database_seeder_twice_does_not_duplicate_users_or_quotes(): void
    {
        Queue::fake();

        $this->seed(DatabaseSeeder::class);
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(1, User::query()->where('email', 'admin@comtanix.test')->count());
        $this->assertSame(1, User::query()->where('email', 'staff1@comtanix.test')->count());
        $this->assertSame(1, User::query()->where('email', 'staff2@comtanix.test')->count());
        $this->assertSame(3, User::query()->count());
        $this->assertSame(200, QuoteRequest::query()->count());
        Queue::assertNotPushed(PublishAuditEvent::class);
    }

    public function test_it_tops_up_five_existing_quotes_to_two_hundred_without_changing_them(): void
    {
        Queue::fake();
        $existingQuotes = QuoteRequest::factory()->count(5)->create();
        $existingSnapshots = $existingQuotes->mapWithKeys(
            fn (QuoteRequest $quoteRequest) => [$quoteRequest->id => $quoteRequest->getAttributes()],
        );

        $this->seed(DatabaseSeeder::class);

        $this->assertSame(200, QuoteRequest::query()->count());

        foreach ($existingSnapshots as $id => $attributes) {
            $preservedQuote = QuoteRequest::query()->findOrFail($id);

            $this->assertEquals(
                $attributes,
                array_intersect_key($preservedQuote->getAttributes(), $attributes),
            );
        }

        $generatedQuotes = QuoteRequest::query()->whereNotIn('id', $existingQuotes->modelKeys());

        $this->assertSame(195, (clone $generatedQuotes)->count());
        $this->assertSame(4, (clone $generatedQuotes)->distinct()->count('status'));
        $this->assertGreaterThan(0, (clone $generatedQuotes)->whereNull('assigned_user_id')->count());
        $this->assertGreaterThan(0, (clone $generatedQuotes)->whereNotNull('assigned_user_id')->count());
        $this->assertSame(
            0,
            (clone $generatedQuotes)
                ->whereNotNull('assigned_user_id')
                ->whereHas('assignedUser', fn ($query) => $query->where('role', '!=', User::ROLE_STAFF))
                ->count(),
        );
        Queue::assertNotPushed(PublishAuditEvent::class);
    }

    public function test_it_does_not_add_quotes_when_two_hundred_already_exist(): void
    {
        Queue::fake();
        $existingIds = QuoteRequest::factory()->count(200)->create()->modelKeys();

        $this->seed(DatabaseSeeder::class);

        $this->assertSame(200, QuoteRequest::query()->count());
        $this->assertSame($existingIds, QuoteRequest::query()->orderBy('id')->pluck('id')->all());
        Queue::assertNotPushed(PublishAuditEvent::class);
    }

    public function test_it_does_not_reduce_a_database_with_more_than_two_hundred_quotes(): void
    {
        Queue::fake();
        $existingIds = QuoteRequest::factory()->count(205)->create()->modelKeys();

        $this->seed(DatabaseSeeder::class);

        $this->assertSame(205, QuoteRequest::query()->count());
        $this->assertSame($existingIds, QuoteRequest::query()->orderBy('id')->pluck('id')->all());
        Queue::assertNotPushed(PublishAuditEvent::class);
    }

    private function assertStatusCount(QuoteRequestStatus $status, int $expected): void
    {
        $this->assertSame(
            $expected,
            QuoteRequest::query()->where('status', $status)->count(),
        );
    }
}
