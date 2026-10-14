<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\StaffUserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

class StaffUserController extends Controller
{
    public function __invoke(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewStaffUsers');

        $staffUsers = User::query()
            ->where('role', User::ROLE_STAFF)
            ->orderBy('name')
            ->get();

        return StaffUserResource::collection($staffUsers);
    }
}
