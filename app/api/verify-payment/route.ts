import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  try {
    // Dynamic import to avoid build errors if Stripe isn't installed
    const Stripe = (await import("stripe")).default;

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json(
        {
          error:
            "Stripe is not configured. Please add STRIPE_SECRET_KEY to your environment variables.",
        },
        { status: 500 }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-11-20.acacia",
    });

    const sessionId = request.nextUrl.searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing session_id" },
        { status: 400 }
      );
    }

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === "paid") {
      // IMPORTANT: Persist premium tier to Supabase so it survives refresh/login.
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const userId = session.metadata?.userId;

      if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json(
          {
            error:
              "Supabase admin credentials are not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
          },
          { status: 500 }
        );
      }

      if (userId) {
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false },
        });

        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: {
            subscriptionTier: "premium",
            stripeCustomerId: session.customer ?? undefined,
          },
        });

        if (error) {
          console.error("Error updating user metadata:", error);
          return NextResponse.json(
            { error: "Failed to update subscription in Supabase" },
            { status: 500 }
          );
        }
      } else {
        console.warn(
          "Stripe checkout session is paid but missing metadata.userId; cannot persist premium tier to Supabase."
        );
      }

      return NextResponse.json({
        success: true,
        subscriptionTier: "premium",
      });
    } else {
      return NextResponse.json(
        { error: "Payment not completed" },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("Error verifying payment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to verify payment" },
      { status: 500 }
    );
  }
}
