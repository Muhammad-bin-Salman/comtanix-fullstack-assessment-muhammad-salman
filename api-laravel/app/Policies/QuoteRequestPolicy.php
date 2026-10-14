<?php

namespace App\Policies;

use App\Models\QuoteRequest;
use App\Models\User;

class QuoteRequestPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdmin() || $user->isStaff();
    }

    public function view(User $user, QuoteRequest $quoteRequest): bool
    {
        return $user->isAdmin() || $user->isStaff();
    }

    public function updateStatus(User $user, QuoteRequest $quoteRequest): bool
    {
        return $user->isAdmin()
            || ($user->isStaff() && $quoteRequest->assigned_user_id === $user->id);
    }

    public function assign(User $user, QuoteRequest $quoteRequest): bool
    {
        return $user->isAdmin();
    }

    public function delete(User $user, QuoteRequest $quoteRequest): bool
    {
        return $user->isAdmin();
    }
}
