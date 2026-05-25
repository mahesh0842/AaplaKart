"""Pydantic models for category request/response schemas."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class SubcategorySchema(BaseModel):
    id: str
    name: str


class CategorySchema(BaseModel):
    id: str
    name: str
    image: str = ""
    subcategories: list[SubcategorySchema] = []


class SectionSchema(BaseModel):
    id: str
    name: str
    type: str  # "kart" | "app"
    image: str = ""
    categories: list[CategorySchema] = []


class SectionsResponse(BaseModel):
    success: bool = True
    sections: list[SectionSchema]


class CategoriesResponse(BaseModel):
    success: bool = True
    categories: list[CategorySchema]
