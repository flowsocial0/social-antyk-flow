import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Helmet } from "react-helmet";
import { Footer } from "@/components/layout/Footer";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const TermsOfService = () => {
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Terms of Service | Social Auto Flow</title>
        <meta
          name="description"
          content="Terms of Service for Social Auto Flow - Social media automation platform"
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
                Terms of Service
              </CardTitle>
              <p className="text-xl text-muted-foreground mt-2">
                Social Auto Flow
              </p>

              <div className="mt-6 max-w-2xl mx-auto">
                <p className="text-muted-foreground">
                  These Terms of Service ("Terms") govern your use of the{" "}
                  <strong>Social Auto Flow</strong> application and website available at{" "}
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
                  <strong>Social Auto Flow</strong> ("Service", "App", or "we") is a social media automation platform 
                  that allows users to schedule, publish, and manage content across multiple social networks including TikTok, 
                  Instagram, Facebook, X (Twitter), and LinkedIn.
                </p>
                <p>
                  By using our Service, you agree to these Terms. If you do not agree, please do not use the Service.
                </p>
              </section>

              <section>
                <h2>2. Definitions</h2>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Service / App</strong> — Social Auto Flow platform available at socialautoflow.pl</li>
                  <li><strong>User</strong> — any individual or entity using the Service</li>
                  <li><strong>Account</strong> — personal account created in the Service</li>
                  <li><strong>Social Platform</strong> — third-party services (TikTok, Instagram, Facebook, X, LinkedIn, etc.)</li>
                  <li><strong>Content</strong> — text, images, videos, or other materials published via the Service</li>
                </ul>
              </section>

              <section>
                <h2>3. Eligibility</h2>
                <p>You must:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Be at least 18 years old (or have parental consent)</li>
                  <li>Create an Account</li>
                  <li>Accept these Terms and our Privacy Policy</li>
                  <li>Have at least one active social media account to connect</li>
                </ul>
              </section>

              <section>
                <h2>4. Account Registration and Security</h2>
                <p>You agree to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Provide accurate and up-to-date information</li>
                  <li>Keep your login credentials confidential</li>
                  <li>Notify us immediately of any unauthorized access</li>
                  <li>Not share your Account with third parties</li>
                </ul>
              </section>

              <section>
                <h2>5. Service Features</h2>
                <p>Social Auto Flow allows you to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Connect accounts from TikTok, Instagram, Facebook, X, and LinkedIn</li>
                  <li>Create, schedule, and publish posts automatically</li>
                  <li>Use AI to generate content</li>
                  <li>Manage multiple social media campaigns in one place</li>
                  <li>Monitor published content performance</li>
                </ul>
              </section>

              <section>
                <h2>6. Integration with Social Platforms</h2>
                <p>When connecting your social accounts, you:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Authorize Social Auto Flow to publish content on your behalf</li>
                  <li>Accept the terms and policies of each connected platform</li>
                  <li>Remain fully responsible for the content you publish</li>
                  <li>Can disconnect any platform at any time</li>
                </ul>
                <p className="mt-4 font-medium">We use official APIs only. You agree to comply with:</p>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  <li>TikTok for Developers Terms of Service</li>
                  <li>Meta Platform Terms (Facebook & Instagram)</li>
                  <li>X Developer Agreement</li>
                  <li>LinkedIn API Terms of Use</li>
                </ul>
              </section>

              <section>
                <h2>7. User Responsibilities</h2>
                <p>You agree not to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Publish content that violates any laws or third-party rights</li>
                  <li>Post offensive, harmful, misleading, or illegal content</li>
                  <li>Violate the rules of any connected social platform</li>
                  <li>Use the Service for spam or deceptive marketing</li>
                  <li>Interfere with the normal operation of the Service</li>
                </ul>
              </section>

              <section>
                <h2>8. Content Ownership and Responsibility</h2>
                <p>You represent and warrant that:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>You own or have rights to all content you publish</li>
                  <li>Content does not infringe copyrights, trademarks, or other rights</li>
                  <li>You are solely responsible for all content published through the Service</li>
                </ul>
              </section>

              <section>
                <h2>9. Limitation of Liability</h2>
                <p>Social Auto Flow:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Strives to keep the Service available and reliable</li>
                  <li>Is not responsible for content published by users</li>
                  <li>Is not liable for actions or changes made by social platforms</li>
                  <li>Does not guarantee 24/7 uptime</li>
                  <li>Reserves the right to perform maintenance</li>
                </ul>
              </section>

              <section>
                <h2>10. Privacy and Data Protection</h2>
                <p>
                  Our data processing practices are described in the{" "}
                  <Link to="/privacy-policy" className="text-primary hover:underline font-medium">
                    Privacy Policy
                  </Link>.
                </p>
                <p>You have the right to access, correct, delete, restrict, or object to the processing of your personal data.</p>
              </section>

              <section>
                <h2>11. Account Termination</h2>
                <p>You may delete your Account at any time by contacting us. Upon deletion:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>All your data will be permanently deleted</li>
                  <li>Access tokens to social platforms will be revoked</li>
                  <li>Scheduled posts will be cancelled</li>
                </ul>
              </section>

              <section>
                <h2>12. Changes to These Terms</h2>
                <p>
                  We may update these Terms. We will notify you at least 14 days in advance. 
                  Continued use of the Service after changes take effect means you accept the new Terms.
                </p>
              </section>

              <section>
                <h2>13. Governing Law</h2>
                <p>
                  These Terms are governed by the laws of Poland. Any disputes will first be attempted to be resolved amicably. 
                  If no agreement is reached, disputes will be resolved by the competent court in Poland.
                </p>
              </section>

              <section>
                <h2>14. Contact</h2>
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

export default TermsOfService;