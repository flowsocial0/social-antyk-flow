import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Helmet } from "react-helmet";
import { Footer } from "@/components/layout/Footer";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const PrivacyPolicy = () => {
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Privacy Policy | Social Auto Flow</title>
        <meta
          name="description"
          content="Privacy Policy for Social Auto Flow - Learn how we protect your personal data"
        />
      </Helmet>

      <main className="flex-1 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Button variant="outline" asChild>
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Homepage
              </Link>
            </Button>
          </div>

          <Card>
            <CardHeader className="text-center">
              {/* === LOGO === */}
              <div className="flex justify-center mb-4">
                <img 
                  src="/favicon.ico" 
                  alt="Social Auto Flow Logo" 
                  className="h-20 w-20 rounded-lg" 
                />
              </div>

              <CardTitle className="text-4xl font-bold">
                Privacy Policy
              </CardTitle>
              <p className="text-xl text-muted-foreground mt-2">
                Social Auto Flow
              </p>

              <div className="mt-6 max-w-2xl mx-auto">
                <p className="text-muted-foreground">
                  This Privacy Policy describes how <strong>Social Auto Flow</strong> ("we", "us", or "our") 
                  collects, uses, and protects your personal information when you use our Service at{" "}
                  <a 
                    href="https://socialautoflow.pl" 
                    className="text-primary hover:underline font-medium"
                  >
                    https://socialautoflow.pl
                  </a>.
                </p>
                <p className="text-sm text-muted-foreground mt-4">
                  Last updated: {currentDate}
                </p>
              </div>
            </CardHeader>

            <CardContent className="prose prose-slate dark:prose-invert max-w-none space-y-8">
              <section>
                <h2>1. Introduction</h2>
                <p>
                  <strong>Social Auto Flow</strong> is a social media automation platform that helps users schedule, 
                  publish, and manage content across TikTok, Instagram, Facebook, X (Twitter), and LinkedIn.
                </p>
                <p>
                  This Privacy Policy explains what data we collect, why we collect it, and how we protect it.
                </p>
              </section>

              <section>
                <h2>2. Data Controller</h2>
                <p>
                  The data controller is <strong>Księgarnia Antyk</strong>.
                </p>
                <p>
                  Contact: <a href="mailto:flowsocial0@gmail.com" className="text-primary">flowsocial0@gmail.com</a>
                </p>
              </section>

              <section>
                <h2>3. Information We Collect</h2>
                <p>We collect the following data:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Account information (email address and encrypted password)</li>
                  <li>Access tokens for connected social platforms (TikTok, Instagram, Facebook, X, LinkedIn)</li>
                  <li>Content you create and publish (text, images, videos)</li>
                  <li>Technical data (IP address, browser information, system logs)</li>
                  <li>Usage data (how you interact with the Service)</li>
                </ul>
              </section>

              <section>
                <h2>4. How We Use Your Data (Legal Basis)</h2>
                <p>We process your data for the following purposes:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Providing the Service</strong> — to operate the automation platform (legal basis: contract performance)</li>
                  <li><strong>Authentication</strong> — to manage user accounts and logins (legal basis: contract performance)</li>
                  <li><strong>Social Media Integration</strong> — to publish content on your behalf (legal basis: consent)</li>
                  <li><strong>Security</strong> — to prevent fraud and protect the platform (legal basis: legitimate interest)</li>
                  <li><strong>Communication</strong> — to respond to your inquiries and provide support (legal basis: legitimate interest)</li>
                </ul>
              </section>

              <section>
                <h2>5. Sharing Your Data</h2>
                <p>We may share your data with:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Social platforms</strong> (TikTok, Meta, X, LinkedIn) — only to publish content you requested</li>
                  <li><strong>Service providers</strong> — such as Supabase (database hosting) and cloud infrastructure providers</li>
                  <li><strong>Legal authorities</strong> — when required by law</li>
                </ul>
                <p className="mt-4">
                  All third parties are bound by data processing agreements and provide appropriate security.
                </p>
              </section>

              <section>
                <h2>6. International Data Transfers</h2>
                <p>
                  Some data may be transferred outside the European Economic Area (e.g. to X/Twitter servers). 
                  In such cases, we use Standard Contractual Clauses approved by the European Commission to ensure adequate protection.
                </p>
              </section>

              <section>
                <h2>7. Data Retention</h2>
                <p>We keep your data for as long as:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Your account is active</li>
                  <li>Required by law (e.g. tax regulations)</li>
                  <li>Necessary to fulfill the purpose for which it was collected</li>
                </ul>
              </section>

              <section>
                <h2>8. Your Rights (GDPR)</h2>
                <p>Under GDPR, you have the right to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Access your personal data</li>
                  <li>Correct inaccurate data</li>
                  <li>Delete your data ("right to be forgotten")</li>
                  <li>Restrict processing</li>
                  <li>Receive your data in a portable format</li>
                  <li>Object to processing based on legitimate interest</li>
                  <li>Withdraw consent at any time</li>
                  <li>Lodge a complaint with a supervisory authority</li>
                </ul>
                <p className="mt-4">
                  To exercise these rights, contact us at: <strong>flowsocial0@gmail.com</strong>
                </p>
              </section>

              <section>
                <h2>9. Data Security</h2>
                <p>We implement appropriate technical and organizational measures, including:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>SSL/TLS encryption for data in transit</li>
                  <li>Password hashing (bcrypt)</li>
                  <li>Regular backups</li>
                  <li>Access controls and monitoring</li>
                  <li>Regular security updates</li>
                </ul>
              </section>

              <section>
                <h2>10. Cookies</h2>
                <p>
                  We use cookies to maintain your session, remember preferences, ensure security, and analyze usage. 
                  You can manage cookie settings in your browser at any time.
                </p>
              </section>

              <section>
                <h2>11. Automated Decision-Making</h2>
                <p>
                  Social Auto Flow does not use automated decision-making or profiling that produces legal effects 
                  or significantly affects you (as defined in Article 22 of the GDPR).
                </p>
              </section>

              <section>
                <h2>12. Changes to This Policy</h2>
                <p>
                  We may update this Privacy Policy. We will notify you at least 14 days in advance. 
                  Continued use of the Service after changes take effect constitutes acceptance of the new policy.
                </p>
              </section>

              <section>
                <h2>13. Contact</h2>
                <div className="bg-muted p-6 rounded-xl mt-4">
                  <p className="font-semibold text-lg">Księgarnia Antyk</p>
                  <p className="mt-2">Email: <a href="mailto:flowsocial0@gmail.com" className="text-primary">flowsocial0@gmail.com</a></p>
                  <p>Website: <a href="https://socialautoflow.pl" className="text-primary">socialautoflow.pl</a></p>
                </div>
              </section>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy;