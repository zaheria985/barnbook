import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getExpenses,
  createExpense,
  getVendorSuggestions,
} from "@/lib/queries/expenses";
import { isMonthClosed } from "@/lib/queries/monthly-budgets";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const month = request.nextUrl.searchParams.get("month");
  const categoryId = request.nextUrl.searchParams.get("category") || undefined;
  const vendorQuery = request.nextUrl.searchParams.get("vendor_suggest");

  if (vendorQuery) {
    try {
      const suggestions = await getVendorSuggestions(vendorQuery);
      return NextResponse.json(suggestions);
    } catch (error) {
      console.error("Failed to fetch vendor suggestions:", error);
      return NextResponse.json(
        { error: "Failed to fetch suggestions" },
        { status: 500 }
      );
    }
  }

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "month query param required (YYYY-MM)" },
      { status: 400 }
    );
  }

  try {
    const expenses = await getExpenses(month, categoryId);
    return NextResponse.json(expenses);
  } catch (error) {
    console.error("Failed to fetch expenses:", error);
    return NextResponse.json(
      { error: "Failed to fetch expenses" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (!body.category_id || body.amount === undefined || !body.date) {
      return NextResponse.json(
        { error: "category_id, amount, and date are required" },
        { status: 400 }
      );
    }

    const yearMonth = body.date.substring(0, 7);
    const closed = await isMonthClosed(yearMonth);
    if (closed) {
      return NextResponse.json(
        { error: "Cannot add expenses to a closed month" },
        { status: 403 }
      );
    }

    const userId = (session.user as { id?: string }).id || null;

    const expense = await createExpense({
      category_id: body.category_id,
      sub_item_id: body.sub_item_id || null,
      amount: Number(body.amount),
      vendor: body.vendor || null,
      date: body.date,
      notes: body.notes || null,
      created_by: userId,
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("Failed to create expense:", error);
    return NextResponse.json(
      { error: "Failed to create expense" },
      { status: 500 }
    );
  }
}
