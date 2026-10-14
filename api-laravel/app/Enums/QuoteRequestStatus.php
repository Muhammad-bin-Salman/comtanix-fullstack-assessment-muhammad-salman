<?php

namespace App\Enums;

enum QuoteRequestStatus: string
{
    case New = 'new';
    case InReview = 'in_review';
    case Quoted = 'quoted';
    case Closed = 'closed';
}
