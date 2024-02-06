import type { Context } from '@netlify/functions';
import { createMollieClient } from '@mollie/api-client';
import validator from 'validator';

// Environment variable can be set through UI or using Netlify CLI
const mollieApiKey = Netlify.env.get("MOLLIE_API_KEY");
const mollieClient = createMollieClient({ apiKey: mollieApiKey });

// There is a limit on the amount per payment method, see https://help.mollie.com/hc/en-us/articles/115000667365-What-is-the-minimum-and-maximum-amount-per-payment-method
const maxAmount = 50000;

/*
 * The entrypoint of the Netlify function.
 */
export default async (req: Request, context: Context) => { 
  // The information is passed as formdata in our example
  return req.formData().then(async (data : FormData) => {
    if (!data) {
      return new Response("Invalid form data", { status: 400 });
    }

    const amount = getAmountFromRequest(data);
    if (!amount) {
      return new Response("Invalid amount in request", { status: 400 });
    }

    const checkoutUrl = await createPayment(amount, getDescriptionFromRequest(data));
    if (!checkoutUrl) {
      return new Response("Failed to properly create payment", { status: 500 });      
    }

    return Response.redirect(checkoutUrl);
  });
}

/*
 * Creates the actual payment and returns the checkout URL to which 
 * the user should be redirected.
 */
async function createPayment(amount: number, description: string) : string {
  // Prevent errors about exceeding the payment amount limit
  amount = Math.min(amount, maxAmount);

  const payment = await mollieClient.payments.create({
    amount: {
      value: amount.toFixed(2), // Must be a string with two decimals
      currency: 'EUR'
    },
    description: description || 'Payment from website',
    redirectUrl: 'https://www.yoursite.com/payment-completed.html', // URL to redirect to on success
    cancelUrl: 'https://www.yoursite.com/payment-cancelled.html' // URL to redirect to when cancelled
  });

  return payment?._links?.checkout?.href;
}

/*
 * Returns the amount from the request as a number, or null if it isn´t a number.
 */
function getAmountFromRequest(data: FormData) : number | null {
  const amount = data.get("amount");
  const amountAsNumber = Number(amount);

  return isNaN(amountAsNumber) ? null : amountAsNumber;
}

/*
 * Returns the sanitized description from the request or null if no 
 * or an invalid description was supplied.
 */
function getDescriptionFromRequest(data: FormData) : string | null {
  const description = data.get("description");

  if (!description || typeof description !== "string") {
    return null;
  }

  return validator.escape(description);
}