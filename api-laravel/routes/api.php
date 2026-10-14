<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\PublicQuoteRequestController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
Route::post('/public/quote-requests', PublicQuoteRequestController::class)
    ->middleware('throttle:public-quotes');

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'me']);
});
