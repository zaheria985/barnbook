import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getTemplate,
  updateTemplate,
  deleteTemplate,
  addTemplateItem,
  deleteTemplateItem,
  addTemplateReminder,
  deleteTemplateReminder,
} from "@/lib/queries/checklist-templates";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const template = await getTemplate(params.id);
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json(template);
  } catch (error) {
    console.error("Failed to fetch template:", error);
    return NextResponse.json({ error: "Failed to fetch template" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Update template metadata
    if (body.name !== undefined || body.event_type !== undefined) {
      await updateTemplate(params.id, {
        name: body.name?.trim(),
        event_type: body.event_type?.trim(),
      });
    }

    // Sync items if provided
    if (body.items) {
      // Delete existing items and re-create
      const existing = await getTemplate(params.id);
      if (existing) {
        for (const item of existing.items) {
          await deleteTemplateItem(item.id);
        }
      }
      for (const item of body.items) {
        await addTemplateItem({
          template_id: params.id,
          title: item.title,
          days_before_event: item.days_before_event,
          sort_order: item.sort_order,
        });
      }
    }

    // Sync reminders if provided
    if (body.reminders) {
      const existing = await getTemplate(params.id);
      if (existing) {
        for (const reminder of existing.reminders) {
          await deleteTemplateReminder(reminder.id);
        }
      }
      for (const reminder of body.reminders) {
        await addTemplateReminder({
          template_id: params.id,
          days_before: reminder.days_before,
        });
      }
    }

    const updated = await getTemplate(params.id);
    if (!updated) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update template:", error);
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deleted = await deleteTemplate(params.id);
    if (!deleted) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete template:", error);
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}
