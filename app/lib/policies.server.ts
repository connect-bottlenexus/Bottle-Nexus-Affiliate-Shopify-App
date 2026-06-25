export type PolicyKey = "privacy" | "terms" | "shipping" | "refund";

export type StoreProfile = {
  name: string;
  email: string;
  address: string;
  phone: string;
};

type PolicyTemplate = {
  key: PolicyKey;
  title: string;
  handle: string;
  body: string;
};

const fallbackProfile: StoreProfile = {
  name: "Your store",
  email: "support@example.com",
  address: "Your store address",
  phone: "Your store phone",
};

const templates: Record<PolicyKey, PolicyTemplate> = {
  privacy: {
    key: "privacy",
    title: "Privacy policy",
    handle: "privacy-policy",
    body: `All alcohol orders are processed and fulfilled by licensed ABC third-party retailers on the Bottle Nexus network. The checkout functionality is provided solely for the convenience of our consumers.

All Alcohol Sales Are Final:

Due to the nature of alcohol products and legal regulations, we are unable to accept returns or offer refunds on any alcohol purchases. Once an order is placed and the transaction is completed, the sale is considered final.

Quality Assurance:

While we cannot accept returns, our team is dedicated to ensuring that your order is accurate and arrives in excellent condition. If you experience any issues with the quality, accuracy, or condition of your order, please contact our customer support team within 30 days of receiving your order. We will work diligently to address your concerns and find a suitable resolution.

Damaged or Incorrect Items:

In the rare event that you receive damaged or incorrect items in your order, please reach out to our customer support team immediately. We will require clear photographic evidence of the issue, including the damaged packaging and products, to assist us in resolving the matter promptly.

BINDING ORDER POLICY - NO CANCELLATION AFTER SHIPMENT & CUSTOMER LIABILITY FOR REFUSED/RETURNED ORDERS

By placing an order on {{Store Name}}, the customer acknowledges and agrees to the following terms, which are legally binding and strictly enforced.
These terms are presented at checkout and are accepted before payment is authorized.
All customers must agree to these terms before completing their purchase.

1. Order Finalization & Customer Responsibility

All product quantities, totals, and order details are clearly displayed during the checkout process.
By completing checkout and authorizing payment, the customer:
Confirms that all order details (including quantity and price) are correct
Accepts full responsibility for reviewing the order before payment
Authorizes {{Store Name}} to process and fulfill the order as submitted
{{Store Name}} is not responsible for customer input errors such as incorrect quantity, wrong product, or inaccurate delivery address.

2. Cancellation Requests - Mandatory Procedure

If a customer wishes to cancel or modify an order, the request must be sent by email to:
{{Store Email}}
This is the only accepted cancellation method.
Messages sent through other channels (social media, other emails, phone, carrier, etc.) are not considered received.

Unshipped Orders (Pending Fulfillment)

If the order has NOT shipped yet:
{{Store Name}} may, at its discretion, waive the $25 restocking fee OR charge it.
No shipping fees apply since the order has not left our facility.
Shipped Orders (Tracking Generated OR In Transit)

Once an order ships or tracking is created, the order is considered Final Sale and cannot be canceled.

3. Customer Refusal, Missed Delivery, or Return-to-Sender

If the customer refuses delivery, misses delivery attempts, or the package is returned to {{Store Name}} due to customer error or change of mind, the customer automatically agrees to the following charges:

Mandatory Fees for Returned or Refused Shipments

These fees will be deducted from any eligible refund:
Outbound Shipping Fee (non-refundable)
Return Shipping Fee (non-refundable)
$25 Restocking Fee
These fees apply regardless of carrier status, including but not limited to:
Package refused at the door
Customer not available
Customer providing incorrect address
Customer changing their mind after shipment
Customer attempting to cancel after shipment
The company reserves the right to accept returns for delivered orders if the customer is dissatisfied, provided that all applicable return fees are paid by the customer.

4. Non-Refundable Items & Fees

The following are strictly non-refundable under all circumstances:
Outbound shipping cost
Return shipping cost
Restocking fee
Any third-party carrier charges
Any items damaged during customer refusal or mishandling
Refunds, when applicable, only apply to the product cost minus all mandatory fees above.

5. Chargebacks & Disputes - Binding Agreement

By completing checkout, the customer expressly agrees not to file a chargeback for:
Change of mind
Incorrect quantity or product selected by customer
Failure to read order confirmation
Refused delivery or missed delivery
Claiming to have contacted support without verifiable email proof to {{Store Email}}
Any situation where the order shipped and the customer later regrets the purchase
{{Store Name}} provides full digital proof to card issuers including:
Checkout logs
IP address
Clickstream quantity selections
Payment authorization
Order confirmation email
Shipping confirmation email
Out-for-delivery notices
Tracking scan records
These Terms & Conditions accepted at checkout
Customers agree that these terms supersede any later claim or dispute.

Any chargeback filed contrary to these terms constitutes fraudulent dispute activity and {{Store Name}} reserves the right to:
Challenge the dispute with all evidence
Seek reimbursement for all financial losses
Pursue legal remedies for fraudulent activity

6. Customer Agreement

By placing an order, the customer confirms that they:
Have read, understood, and accepted this policy
Agree these terms are binding
Understand they cannot dispute charges that adhere to this policy
Accept full liability for shipping and restocking fees on returned/refused shipments
Completion of checkout serves as the customer's digital signature and binding consent to all policies contained herein.

Contact Us:

For any inquiries, concerns, or assistance, please don't hesitate to contact our customer support team at {{Store Email}} / {{Store Phone}}
We are here to help you have a positive experience and ensure your satisfaction.`,
  },
  terms: {
    key: "terms",
    title: "Terms of service",
    handle: "terms-of-service",
    body: `This Privacy Policy describes how this website ("we," "our," or "us") collects, uses, and shares your personal information when you visit our website (the "Site") or use our services. By using the Site and our services, you agree to the practices described in this policy.

Information We Collect:

Personal Information: We may collect personal information such as your name, email address, mailing address, phone number, and other contact details when you voluntarily provide them to us through forms on our Site.
Usage Information: We may collect information about how you interact with our Site, including your IP address, browser type, operating system, pages viewed, and referring URLs.
Cookies: We use cookies and similar tracking technologies to collect information about your browsing activities on our Site. You can control cookies through your browser settings.

How We Use Your Information:

We use your personal information to communicate with you, process your orders, provide customer support, and improve our services.
Please note that "{{Store Name}}" will appear on your credit card statement for any purchases made through our Site.
We may use your usage information and cookies to analyze trends, monitor the performance of our Site, and personalize your experience.

Sharing Your Information:

We do not sell, trade, or rent your personal information to third parties.
We may share your information with trusted third-party service providers who assist us in operating our Site and providing services to you.

Data Security:

We take reasonable measures to protect your personal information from unauthorized access, disclosure, alteration, or destruction.

Your Choices:

You can choose not to provide certain information, but this may affect your ability to access certain features of our Site or use our services.
You can manage cookies through your browser settings or opt-out of certain third-party tracking tools.

Children's Privacy:

Our Site is not directed at individuals under the age of 21. We do not knowingly collect personal information from children.

Changes to this Privacy Policy:

We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page.

Order Changes & Cancellations

Once an order is placed on {{Store Name}}, it enters automated processing and fulfillment.
If a customer wishes to modify or cancel an order for any reason - including accidental quantity selection, change of mind, or incorrect address - the customer must contact us immediately at:
{{Store Email}}
This is the only accepted method for submitting a cancellation or order-change request.
Messages sent to any other email addresses, social media accounts, or third-party channels are not considered received and will not be processed.
{{Store Name}} is not responsible for customer errors in quantity selection, product selection, or address entry.

Order Cancellation Window

Cancellation requests are only eligible if received before the order has shipped.
Once tracking has been generated or the package has left our facility, the order is considered Final Sale and cannot be cancelled.

BINDING ORDER POLICY - NO CANCELLATION AFTER SHIPMENT & CUSTOMER LIABILITY FOR REFUSED/RETURNED ORDERS

By placing an order on {{Store Name}}, the customer acknowledges and agrees to the following terms, which are legally binding and strictly enforced.
These terms are presented at checkout and are accepted before payment is authorized.
All customers must agree to these terms before completing their purchase.

1. Order Finalization & Customer Responsibility

All product quantities, totals, and order details are clearly displayed during the checkout process.
By completing checkout and authorizing payment, the customer:
Confirms that all order details (including quantity and price) are correct
Accepts full responsibility for reviewing the order before payment
Authorizes {{Store Name}} to process and fulfill the order as submitted
{{Store Name}} is not responsible for customer input errors such as incorrect quantity, wrong product, or inaccurate delivery address.

2. Cancellation Requests - Mandatory Procedure

If a customer wishes to cancel or modify an order, the request must be sent by email to:
{{Store Email}}
This is the only accepted cancellation method.
Messages sent through other channels (social media, other emails, phone, carrier, etc.) are not considered received.

Unshipped Orders (Pending Fulfillment)

If the order has NOT shipped yet:
{{Store Name}} may, at its discretion, waive the $25 restocking fee OR charge it.
No shipping fees apply since the order has not left our facility.
Shipped Orders (Tracking Generated OR In Transit)

Once an order ships or tracking is created, the order is considered Final Sale and cannot be canceled.

3. Customer Refusal, Missed Delivery, or Return-to-Sender

If the customer refuses delivery, misses delivery attempts, or the package is returned to {{Store Name}} due to customer error or change of mind, the customer automatically agrees to the following charges:

Mandatory Fees for Returned or Refused Shipments

These fees will be deducted from any eligible refund:
Outbound Shipping Fee (non-refundable)
Return Shipping Fee (non-refundable)
$25 Restocking Fee
These fees apply regardless of carrier status, including but not limited to:
Package refused at the door
Customer not available
Customer providing incorrect address
Customer changing their mind after shipment
Customer attempting to cancel after shipment

4. Non-Refundable Items & Fees

The following are strictly non-refundable under all circumstances:
Outbound shipping cost
Return shipping cost
Restocking fee
Any third-party carrier charges
Any items damaged during customer refusal or mishandling
Refunds, when applicable, only apply to the product cost minus all mandatory fees above.

5. Chargebacks & Disputes - Binding Agreement

By completing checkout, the customer expressly agrees not to file a chargeback for:
Change of mind
Incorrect quantity or product selected by customer
Failure to read order confirmation
Refused delivery or missed delivery
Claiming to have contacted support without verifiable email proof to {{Store Email}}
Any situation where the order shipped and the customer later regrets the purchase
{{Store Name}} provides full digital proof to card issuers including:
Checkout logs
IP address
Clickstream quantity selections
Payment authorization
Order confirmation email
Shipping confirmation email
Out-for-delivery notices
Tracking scan records
These Terms & Conditions accepted at checkout
Customers agree that these terms supersede any later claim or dispute.

Any chargeback filed contrary to these terms constitutes fraudulent dispute activity and {{Store Name}} reserves the right to:
Challenge the dispute with all evidence
Seek reimbursement for all financial losses
Pursue legal remedies for fraudulent activity

6. Customer Agreement

By placing an order, the customer confirms that they:
Have read, understood, and accepted this policy
Agree these terms are binding
Understand they cannot dispute charges that adhere to this policy
Accept full liability for shipping and restocking fees on returned/refused shipments
Completion of checkout serves as the customer's digital signature and binding consent to all policies contained herein.

Contact Us:
If you have any questions about this Privacy Policy, please contact us at {{Store Email}} / {{Store Phone}}`,
  },
  shipping: {
    key: "shipping",
    title: "Shipping policy",
    handle: "shipping-policy",
    body: `{{Store Name}} Shipping & Cancellations & Refund Policy

Age & Legal Compliance

You must be at least 21 years of age to place an order. A signature from an individual 21 years or older is required upon delivery. Valid government-issued photo identification must be presented at the time of delivery.

By placing an order, you affirm that you are of legal drinking age and understand that the customer is solely responsible for compliance with all applicable local, state, and federal laws regarding the shipment and receipt of alcoholic beverages.
We reserve the right to cancel and refund any order if we believe it violates shipping or alcohol regulations in your area.

Shipping Restrictions

No deliveries on weekends (Saturday or Sunday).
We cannot ship to P.O. Boxes or APO/FPO addresses.
All alcohol orders are processed and fulfilled by licensed ABC third-party retailers on the Bottle Nexus network. The checkout functionality is provided solely for the convenience of our consumers.
We only ship within the United States and currently cannot ship to the following states:
UT / SD / HI / AK

Shipping Options

We ship via FedEx, UPS, and GLS (GSO). Available shipping methods include Ground, 2-Day Air, and Next Day Air.
Because all alcohol deliveries require an adult signature and ID verification, we highly recommend shipping to a business address to avoid missed deliveries.

Orders placed on weekends or holidays will begin processing the following business day. Please allow additional time during peak seasons (e.g. Black Friday, Christmas, or major sales events).
Ground Shipping: 2-10 business days in transit, depending on location.
Expedited Shipping (2-Day / Next Day): Orders placed before 4 PM PST ship the next business day, pending item availability.

Please note that real-time inventory levels may vary. We do our best to fulfill all orders promptly.

Free Shipping Policy

Free shipping promotions, when available, apply to one box (typically 6-12 bottles, depending on size and weight) via standard ground shipping only.
If your order exceeds this limit, an additional shipping charge may apply.

Orders over $150 may qualify for free ground shipping at our discretion. In rare cases where shipping costs exceed profitability, {{Store Name}} reserves the right to:
(A) Cancel the order
(B) Request shared shipping costs
(C) Adjust the order to balance fulfillment costs

We appreciate your understanding - we are an independent, family-founded company, not a mass retailer, and these policies help us maintain quality service and fair pricing.

Refund & Return Policy

All sales are final.
Due to state and federal alcohol laws, we cannot accept returns or offer refunds once a product has been shipped.

Exceptions are made only if a product is damaged, spoiled, or otherwise unfit for consumption upon arrival, as permitted under California law.
If you receive a damaged or defective product, please contact us immediately at
{{Store Email}}
We take pride in our customer service - if an issue arises, our team will work with you to ensure a satisfactory resolution whenever possible.

Undeliverable Packages

If a package is returned to us because it was undeliverable (e.g., recipient unavailable for signature, incorrect address, or failure to pick up), the customer will be charged for all shipping costs, including the return shipping fees billed by the carrier.

Please ensure all shipping details are correct and that an adult is available to sign for the delivery.

BINDING ORDER POLICY - NO CANCELLATION AFTER SHIPMENT & CUSTOMER LIABILITY FOR REFUSED/RETURNED ORDERS
By placing an order on {{Store Name}}, the customer acknowledges and agrees to the following terms, which are legally binding and strictly enforced.
These terms are presented at checkout and are accepted before payment is authorized.
All customers must agree to these terms before completing their purchase.

1. Order Finalization & Customer Responsibility
All product quantities, totals, and order details are clearly displayed during the checkout process.
By completing checkout and authorizing payment, the customer:
Confirms that all order details (including quantity and price) are correct
Accepts full responsibility for reviewing the order before payment
Authorizes {{Store Name}} to process and fulfill the order as submitted
{{Store Name}} is not responsible for customer input errors such as incorrect quantity, wrong product, or inaccurate delivery address.

2. Cancellation Requests - Mandatory Procedure

If a customer wishes to cancel or modify an order, the request must be sent by email to:
{{Store Email}}
This is the only accepted cancellation method.
Messages sent through other channels (social media, other emails, phone, carrier, etc.) are not considered received.

Unshipped Orders (Pending Fulfillment)

If the order has NOT shipped yet:
{{Store Name}} may, at its discretion, waive the $25 restocking fee OR charge it.
No shipping fees apply since the order has not left our facility.

Shipped Orders (Tracking Generated OR In Transit)

Once an order ships or tracking is created, the order is considered Final Sale and cannot be canceled.

3. Customer Refusal, Missed Delivery, or Return-to-Sender
If the customer refuses delivery, misses delivery attempts, or the package is returned to {{Store Name}} due to customer error or change of mind, the customer automatically agrees to the following charges:

Mandatory Fees for Returned or Refused Shipments

These fees will be deducted from any eligible refund:
1. Outbound Shipping Fee (non-refundable)
2. Return Shipping Fee (non-refundable)
3. $25 Restocking Fee

These fees apply regardless of carrier status, including but not limited to:
Package refused at the door
Customer not available
Customer providing incorrect address
Customer changing their mind after shipment
Customer attempting to cancel after shipment

4. Non-Refundable Items & Fees

The following are strictly non-refundable under all circumstances:
Outbound shipping cost
Return shipping cost
Restocking fee
Any third-party carrier charges
Any items damaged during customer refusal or mishandling
Refunds, when applicable, only apply to the product cost minus all mandatory fees above.

5. Chargebacks & Disputes - Binding Agreement

By completing checkout, the customer expressly agrees not to file a chargeback for:
Change of mind
Incorrect quantity or product selected by customer
Failure to read order confirmation
Refused delivery or missed delivery
Claiming to have contacted support without verifiable email proof to {{Store Email}}
Any situation where the order shipped and the customer later regrets the purchase

{{Store Name}} provides full digital proof to card issuers including:
Checkout logs
IP address
Clickstream quantity selections
Payment authorization
Order confirmation email
Shipping confirmation email
Out-for-delivery notices
Tracking scan records
These Terms & Conditions accepted at checkout

Customers agree that these terms supersede any later claim or dispute.

Any chargeback filed contrary to these terms constitutes fraudulent dispute activity and {{Store Name}} reserves the right to:
Challenge the dispute with all evidence
Seek reimbursement for all financial losses
Pursue legal remedies for fraudulent activity

6. Customer Agreement

By placing an order, the customer confirms that they:
Have read, understood, and accepted this policy
Agree these terms are binding
Understand they cannot dispute charges that adhere to this policy
Accept full liability for shipping and restocking fees on returned/refused shipments
Completion of checkout serves as the customer's digital signature and binding consent to all policies contained herein.

Customer Service

For any inquiries, assistance, or order-related issues, please contact our support team at:
{{Store Email}}
{{Store address}}

We appreciate your business and your trust. Every bottle that leaves our cask is handled with care - and every customer is part of the Caskwell voyage.`,
  },
  refund: {
    key: "refund",
    title: "Refund policy",
    handle: "refund-policy",
    body: `All alcohol orders are processed and fulfilled by licensed ABC third-party retailers on the Bottle Nexus network. The checkout functionality is provided solely for the convenience of our consumers.

All Alcohol Sales Are Final:

Due to the nature of alcohol products and legal regulations, we are unable to accept returns or offer refunds on any alcohol purchases. Once an order is placed and the transaction is completed, the sale is considered final.

Quality Assurance:
While we cannot accept returns, our team is dedicated to ensuring that your order is accurate and arrives in excellent condition. If you experience any issues with the quality, accuracy, or condition of your order, please contact our customer support team within 30 days of receiving your order. We will work diligently to address your concerns and find a suitable resolution.

Damaged or Incorrect Items:
In the rare event that you receive damaged or incorrect items in your order, please reach out to our customer support team immediately. We will require clear photographic evidence of the issue, including the damaged packaging and products, to assist us in resolving the matter promptly.

BINDING ORDER POLICY - NO CANCELLATION AFTER SHIPMENT & CUSTOMER LIABILITY FOR REFUSED/RETURNED ORDERS
By placing an order on {{Store Name}}, the customer acknowledges and agrees to the following terms, which are legally binding and strictly enforced.
These terms are presented at checkout and are accepted before payment is authorized.
All customers must agree to these terms before completing their purchase.

1. Order Finalization & Customer Responsibility
All product quantities, totals, and order details are clearly displayed during the checkout process.
By completing checkout and authorizing payment, the customer:
Confirms that all order details (including quantity and price) are correct
Accepts full responsibility for reviewing the order before payment
Authorizes {{Store Name}} to process and fulfill the order as submitted
{{Store Name}} is not responsible for customer input errors such as incorrect quantity, wrong product, or inaccurate delivery address.

2. Cancellation Requests - Mandatory Procedure

If a customer wishes to cancel or modify an order, the request must be sent by email to:
{{Store Email}}
This is the only accepted cancellation method.
Messages sent through other channels (social media, other emails, phone, carrier, etc.) are not considered received.

Unshipped Orders (Pending Fulfillment)

If the order has NOT shipped yet:
{{Store Name}} may, at its discretion, waive the $25 restocking fee OR charge it.
No shipping fees apply since the order has not left our facility.

Shipped Orders (Tracking Generated OR In Transit)

Once an order ships or tracking is created, the order is considered Final Sale and cannot be canceled.

3. Customer Refusal, Missed Delivery, or Return-to-Sender
If the customer refuses delivery, misses delivery attempts, or the package is returned to {{Store Name}} due to customer error or change of mind, the customer automatically agrees to the following charges:

Mandatory Fees for Returned or Refused Shipments

These fees will be deducted from any eligible refund:
1. Outbound Shipping Fee (non-refundable)
2. Return Shipping Fee (non-refundable)
3. $25 Restocking Fee

These fees apply regardless of carrier status, including but not limited to:
Package refused at the door
Customer not available
Customer providing incorrect address
Customer changing their mind after shipment
Customer attempting to cancel after shipment

The company reserves the right to accept returns for delivered orders if the customer is dissatisfied, provided that all applicable return fees are paid by the customer.

4. Non-Refundable Items & Fees

The following are strictly non-refundable under all circumstances:
Outbound shipping cost
Return shipping cost
Restocking fee
Any third-party carrier charges
Any items damaged during customer refusal or mishandling

Refunds, when applicable, only apply to the product cost minus all mandatory fees above.

5. Chargebacks & Disputes - Binding Agreement

By completing checkout, the customer expressly agrees not to file a chargeback for:
Change of mind
Incorrect quantity or product selected by customer
Failure to read order confirmation
Refused delivery or missed delivery
Claiming to have contacted support without verifiable email proof to {{Store Email}}
Any situation where the order shipped and the customer later regrets the purchase

{{Store Name}} provides full digital proof to card issuers including:
Checkout logs
IP address
Clickstream quantity selections
Payment authorization
Order confirmation email
Shipping confirmation email
Out-for-delivery notices
Tracking scan records
These Terms & Conditions accepted at checkout

Customers agree that these terms supersede any later claim or dispute.

Any chargeback filed contrary to these terms constitutes fraudulent dispute activity and {{Store Name}} reserves the right to:
Challenge the dispute with all evidence
Seek reimbursement for all financial losses
Pursue legal remedies for fraudulent activity

6. Customer Agreement

By placing an order, the customer confirms that they:
Have read, understood, and accepted this policy
Agree these terms are binding
Understand they cannot dispute charges that adhere to this policy
Accept full liability for shipping and restocking fees on returned/refused shipments
Completion of checkout serves as the customer's digital signature and binding consent to all policies contained herein.

Contact Us:

For any inquiries, concerns, or assistance, please don't hesitate to contact our customer support team at {{Store Email}} / {{Store Phone}}

We are here to help you have a positive experience and ensure your satisfaction.`,
  },
};

export function getPolicyTemplates() {
  return Object.values(templates);
}

export function getPolicyTemplate(key: string) {
  if (!isPolicyKey(key)) {
    throw new Error("Unknown policy");
  }

  return templates[key];
}

export function isPolicyKey(key: string): key is PolicyKey {
  return key in templates;
}

export function renderPolicyBody(
  key: PolicyKey,
  profile: Partial<StoreProfile>,
) {
  const storeProfile = { ...fallbackProfile, ...profile };
  return plainTextToHtml(
    templates[key].body
      .replaceAll("{{Store Name}}", storeProfile.name)
      .replaceAll("{{Store Email}}", storeProfile.email)
      .replaceAll("{{Store address}}", storeProfile.address)
      .replaceAll("{{Store Phone}}", storeProfile.phone),
  );
}

function plainTextToHtml(body: string) {
  return body
    .split(/\n{2,}/)
    .map((block) => {
      const safeBlock = escapeHtml(block.trim()).replace(/\n/g, "<br>");
      if (/^\d+\.\s/.test(block) || /^[A-Z][A-Z\s&$()-]+$/.test(block)) {
        return `<h3>${safeBlock}</h3>`;
      }
      if (/^[A-Z][A-Za-z\s&]+:$/.test(block.trim())) {
        return `<h3>${safeBlock}</h3>`;
      }
      return `<p>${safeBlock}</p>`;
    })
    .join("\n");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
