import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSales, createSale } from "@/lib/queries/sales";
import { isMonthClosed } from "@/lib/queries/monthly-budgets";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const month = request.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "month query param required (YYYY-MM)" },
      { status: 400 }
    );
  }

  try {
    const sales = await getSales(month);
    return NextResponse.json(sales);
  } catch (error) {
    console.error("Failed to fetch sales:", error);
    return NextResponse.json(
      { error: "Failed to fetch sales" },
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

    if (!body.description || body.amount === undefined || !body.date) {
      return NextResponse.json(
        { error: "description, amount, and date are required" },
        { status: 400 }
      );
    }

    const yearMonth = body.date.substring(0, 7);
    const closed = await isMonthClosed(yearMonth);
    if (closed) {
      return NextResponse.json(
        { error: "Cannot add sales to a closed month" },
        { status: 403 }
      );
    }

    const userId = (session.user as { id?: string }).id || null;

    const sale = await createSale({
      description: body.description,
      amount: Number(body.amount),
      date: body.date,
      created_by: userId,
    });

    return NextResponse.json(sale, { status: 201 });
  } catch (error) {
    console.error("Failed to create sale:", error);
    return NextResponse.json(
      { error: "Failed to create sale" },
      { status: 500 }
    );
  }
}
