import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to wait for container to be ready
async function waitForContainer(containerId: string, accessToken: string, maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${containerId}?fields=status_code&access_token=${accessToken}`
    );
    const data = await response.json();
    
    console.log(`Container status check ${i + 1}:`, data.status_code);
    
    if (data.status_code === 'FINISHED') {
      return true;
    } else if (data.status_code === 'ERROR') {
      throw new Error('Container processing failed');
    }
    
    // Wait 2 seconds before next check
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookId, userId, caption, imageUrl } = await req.json();

    console.log('Publishing to Instagram:', { bookId, userId, hasCaption: !!caption, hasImage: !!imageUrl });

    if (!userId) {
      throw new Error('Missing userId');
    }

    if (!imageUrl) {
      throw new Error('Instagram requires an image. Text-only posts are not supported.');
    }

    // Get Instagram token from database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: tokenData, error: tokenError } = await supabase
      .from('instagram_oauth_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (tokenError || !tokenData) {
      console.error('Token not found:', tokenError);
      throw new Error('Instagram account not connected. Please connect your account first.');
    }

    const { access_token, instagram_account_id, expires_at } = tokenData;

    // Check if token is expired
    if (expires_at && new Date(expires_at) < new Date()) {
      throw new Error('Instagram access token has expired. Please reconnect your account.');
    }

    console.log('Found Instagram account:', instagram_account_id);

    // Step 1: Create media container
    console.log('Creating media container...');
    const containerParams = new URLSearchParams({
      image_url: imageUrl,
      access_token: access_token,
    });

    if (caption) {
      containerParams.set('caption', caption);
    }

    const containerResponse = await fetch(
      `https://graph.facebook.com/v21.0/${instagram_account_id}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: containerParams.toString(),
      }
    );

    const containerData = await containerResponse.json();

    if (containerData.error) {
      console.error('Error creating container:', containerData.error);
      throw new Error(containerData.error.message || 'Failed to create media container');
    }

    const containerId = containerData.id;
    console.log('Created container:', containerId);

    // Step 2: Wait for container to be ready (for video/carousel, images are usually instant)
    console.log('Waiting for container to be ready...');
    const isReady = await waitForContainer(containerId, access_token);
    
    if (!isReady) {
      throw new Error('Container processing timed out');
    }

    // Step 3: Publish the container
    console.log('Publishing container...');
    const publishResponse = await fetch(
      `https://graph.facebook.com/v21.0/${instagram_account_id}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          creation_id: containerId,
          access_token: access_token,
        }).toString(),
      }
    );

    const publishData = await publishResponse.json();

    if (publishData.error) {
      console.error('Error publishing:', publishData.error);
      throw new Error(publishData.error.message || 'Failed to publish to Instagram');
    }

    const mediaId = publishData.id;
    console.log('Published successfully! Media ID:', mediaId);

    // Update book status if bookId provided
    if (bookId) {
      await supabase
        .from('books')
        .update({
          published: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        mediaId,
        message: 'Successfully published to Instagram',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in publish-to-instagram:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
