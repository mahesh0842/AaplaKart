"""Pydantic models for product request/response schemas."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class ProductOption(BaseModel):
    label: str
    price: float


class ProductSchema(BaseModel):
    id: str
    name: str
    price: float
    category: str
    categoryId: Optional[str] = ""
    subcategory: Optional[str] = ""
    subcategoryId: Optional[str] = ""
    type: Optional[str] = "kart"  # "kart" | "app"
    brand: Optional[str] = "kart"
    image: Optional[str] = ""
    rating: Optional[float] = 0
    deliveryTime: Optional[str] = "20 min"
    stock: Optional[int] = 0
    weight: Optional[str] = ""
    options: Optional[list[ProductOption]] = None


class CreateProductRequest(BaseModel):
    name: str
    price: float
    category: str
    categoryId: Optional[str] = ""
    subcategory: Optional[str] = ""
    subcategoryId: Optional[str] = ""
    type: Optional[str] = "kart"
    brand: Optional[str] = "kart"
    image: Optional[str] = ""
    rating: Optional[float] = 0
    deliveryTime: Optional[str] = "20 min"
    stock: Optional[int] = 0
    weight: Optional[str] = ""
    options: Optional[list[ProductOption]] = None


class UpdateProductRequest(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    categoryId: Optional[str] = None
    subcategory: Optional[str] = None
    subcategoryId: Optional[str] = None
    type: Optional[str] = None
    brand: Optional[str] = None
    image: Optional[str] = None
    rating: Optional[float] = None
    deliveryTime: Optional[str] = None
    stock: Optional[int] = None
    weight: Optional[str] = None
    options: Optional[list[ProductOption]] = None


class ProductsResponse(BaseModel):
    success: bool = True
    count: int
    page: Optional[int] = 1
    page_size: Optional[int] = 50
    products: list[ProductSchema]


class ProductResponse(BaseModel):
    success: bool = True
    product: ProductSchema


class CategoriesResponse(BaseModel):
    success: bool = True
    categories: list[str]
