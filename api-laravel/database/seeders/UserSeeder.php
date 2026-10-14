<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $password = Hash::make('Password123!');

        $this->updateOrCreateAssessmentUser(
            name: 'Assessment Admin',
            email: 'admin@comtanix.test',
            role: User::ROLE_ADMIN,
            password: $password,
        );

        $this->updateOrCreateAssessmentUser(
            name: 'Staff One',
            email: 'staff1@comtanix.test',
            role: User::ROLE_STAFF,
            password: $password,
        );

        $this->updateOrCreateAssessmentUser(
            name: 'Staff Two',
            email: 'staff2@comtanix.test',
            role: User::ROLE_STAFF,
            password: $password,
        );
    }

    private function updateOrCreateAssessmentUser(
        string $name,
        string $email,
        string $role,
        string $password,
    ): void {
        $user = User::query()->firstOrNew(['email' => $email]);

        $user->forceFill([
            'name' => $name,
            'role' => $role,
            'password' => $password,
            'email_verified_at' => $user->email_verified_at ?? now(),
        ])->save();
    }
}
