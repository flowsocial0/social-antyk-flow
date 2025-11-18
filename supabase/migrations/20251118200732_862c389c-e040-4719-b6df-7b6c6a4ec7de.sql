-- Add user_id to twitter_oauth_tokens table
ALTER TABLE twitter_oauth_tokens 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add unique constraint on user_id for twitter_oauth_tokens
ALTER TABLE twitter_oauth_tokens 
ADD CONSTRAINT twitter_oauth_tokens_user_id_unique UNIQUE (user_id);

-- Drop old policy for twitter_oauth_tokens
DROP POLICY IF EXISTS "Allow all operations on twitter_oauth_tokens" ON twitter_oauth_tokens;

-- Create new RLS policies for twitter_oauth_tokens
CREATE POLICY "Users can view their own twitter tokens"
ON twitter_oauth_tokens
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own twitter tokens"
ON twitter_oauth_tokens
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own twitter tokens"
ON twitter_oauth_tokens
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own twitter tokens"
ON twitter_oauth_tokens
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Add user_id to facebook_oauth_tokens table
ALTER TABLE facebook_oauth_tokens 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add unique constraint on user_id for facebook_oauth_tokens
ALTER TABLE facebook_oauth_tokens 
ADD CONSTRAINT facebook_oauth_tokens_user_id_unique UNIQUE (user_id);

-- Drop old policy for facebook_oauth_tokens
DROP POLICY IF EXISTS "Allow all operations on facebook_oauth_tokens" ON facebook_oauth_tokens;

-- Create new RLS policies for facebook_oauth_tokens
CREATE POLICY "Users can view their own facebook tokens"
ON facebook_oauth_tokens
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own facebook tokens"
ON facebook_oauth_tokens
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own facebook tokens"
ON facebook_oauth_tokens
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own facebook tokens"
ON facebook_oauth_tokens
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);