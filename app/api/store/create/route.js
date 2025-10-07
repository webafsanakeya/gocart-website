import imagekit from "@/configs/imageKit";
import prisma from "@/lib/prisma";
import { getAuth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// --- POST: Create Store ---
export async function POST(request) {
  try {
    const { userId } = getAuth(request);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const name = formData.get("name");
    const username = formData.get("username");
    const description = formData.get("description");
    const email = formData.get("email");
    const contact = formData.get("contact");
    const address = formData.get("address");
    const image = formData.get("image");

    if (!name || !username || !description || !email || !contact || !address || !image) {
      return NextResponse.json({ error: "Missing store info" }, { status: 400 });
    }

    // --- Check if user already has a store ---
    const existingStore = await prisma.store.findFirst({
      where: { userId },
    });

    if (existingStore) {
      return NextResponse.json({ status: existingStore.status });
    }

    // --- Check if username already taken ---
    const isUserNameTaken = await prisma.store.findFirst({
      where: { username: username.toLowerCase() }, // ✅ fixed field name
    });

    if (isUserNameTaken) {
      return NextResponse.json({ error: "Username already taken" }, { status: 400 });
    }

    // --- Upload logo to ImageKit ---
    const buffer = Buffer.from(await image.arrayBuffer());

    const uploadResponse = await imagekit.upload({
      file: buffer,
      fileName: image.name,
      folder: "logos",
    });

    // Generate optimized version
    const optimizedImage = imagekit.url({
      path: uploadResponse.filePath,
      transformation: [
        { quality: "auto" },
        { format: "webp" },
        { width: "512" },
      ],
    });

    // --- Create store record ---
    const newStore = await prisma.store.create({
      data: {
        userId,
        name,
        description,
        username: username.toLowerCase(),
        email,
        contact,
        address,
        logo: optimizedImage,
      },
    });

    // --- Link store to user (only if relation exists) ---
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { store: { connect: { id: newStore.id } } },
      });
    } catch (relError) {
      console.warn("User relation update skipped:", relError.message);
    }

    return NextResponse.json({
      message: "Store application submitted. Awaiting approval.",
    });
  } catch (error) {
    console.error("Error creating store:", error);
    return NextResponse.json(
      { error: "Failed to create store. Please try again later." },
      { status: 500 }
    );
  }
}

// --- GET: Check store status ---
export async function GET(request) {
  try {
    const { userId } = getAuth(request);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const store = await prisma.store.findFirst({
      where: { userId },
    });

    if (store) {
      return NextResponse.json({ status: store.status });
    }

    return NextResponse.json({ status: "not registered" });
  } catch (error) {
    console.error("Error checking store status:", error);
    return NextResponse.json(
      { error: "Failed to check store status" },
      { status: 500 }
    );
  }
}
