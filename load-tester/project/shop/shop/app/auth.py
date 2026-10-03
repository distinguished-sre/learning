import re

import bcrypt
from fastapi import HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from .cache import redis
from . import settings


class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1)

    @field_validator("email")
    @classmethod
    def valid_email(cls, value):
        value = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Нужен email")
        return value

    @field_validator("password")
    @classmethod
    def valid_password(cls, value):
        # bcrypt принимает максимум 72 БАЙТА, а не 72 символа.
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Пароль длиннее 72 байт")
        return value


class Registration(Credentials):
    password: str = Field(min_length=8)


def password_hash(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(settings.BCRYPT_ROUNDS)).decode()


def current_user(request: Request):
    parts = request.headers.get("Authorization", "").split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(401, "bearer token required")
    user_id = redis.get(f"session:{parts[1]}")
    if user_id is None:
        raise HTTPException(401, "invalid or expired token")
    request.state.user_id = int(user_id)
    return int(user_id)
