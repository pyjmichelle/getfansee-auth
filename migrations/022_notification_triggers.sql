-- 022_notification_triggers.sql
-- 通知系统触发器
-- 自动在特定事件发生时创建通知

-- ============================================
-- 1. 新订阅通知（给 Creator）
-- ============================================

CREATE OR REPLACE FUNCTION notify_new_subscription()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  subscriber_name text;
BEGIN
  -- 获取订阅者名称
  SELECT display_name INTO subscriber_name
  FROM profiles
  WHERE id = NEW.subscriber_id;

  -- 创建通知给 Creator
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    link
  ) VALUES (
    NEW.creator_id,
    'subscription',
    'New Subscriber!',
    subscriber_name || ' subscribed to your content',
    '/creator/studio/subscribers'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 触发器
DROP TRIGGER IF EXISTS subscription_notification_trigger ON subscriptions;
CREATE TRIGGER subscription_notification_trigger
AFTER INSERT ON subscriptions
FOR EACH ROW
WHEN (NEW.status = 'active')
EXECUTE FUNCTION notify_new_subscription();

-- ============================================
-- 2. PPV 购买通知（给 Creator）
-- ============================================

CREATE OR REPLACE FUNCTION notify_ppv_purchase()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fan_name text;
  post_title text;
  creator_id_var uuid;
BEGIN
  -- 获取粉丝名称
  SELECT display_name INTO fan_name
  FROM profiles
  WHERE id = NEW.fan_id;

  -- 获取帖子信息
  SELECT title, posts.creator_id INTO post_title, creator_id_var
  FROM posts
  WHERE id = NEW.post_id;

  -- 创建通知给 Creator
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    link
  ) VALUES (
    creator_id_var,
    'payment',
    'Content Purchased!',
    fan_name || ' purchased your content: ' || COALESCE(post_title, 'Untitled'),
    '/creator/studio/earnings'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 触发器
DROP TRIGGER IF EXISTS purchase_notification_trigger ON purchases;
CREATE TRIGGER purchase_notification_trigger
AFTER INSERT ON purchases
FOR EACH ROW
EXECUTE FUNCTION notify_ppv_purchase();

-- ============================================
-- 3. 点赞通知（给 Creator）
-- ============================================

CREATE OR REPLACE FUNCTION notify_post_like()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  liker_name text;
  post_title text;
  creator_id_var uuid;
  like_count integer;
BEGIN
  -- 获取点赞用户名称
  SELECT display_name INTO liker_name
  FROM profiles
  WHERE id = NEW.user_id;

  -- 获取帖子信息和点赞数
  SELECT title, posts.creator_id, likes_count INTO post_title, creator_id_var, like_count
  FROM posts
  WHERE id = NEW.post_id;

  -- 只在特定点赞数时通知（避免通知过多）
  -- 例如：第1个、第10个、第50个、第100个等
  IF like_count IN (1, 10, 50, 100, 500, 1000) THEN
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      link
    ) VALUES (
      creator_id_var,
      'like',
      'Your content is popular!',
      'Your post reached ' || like_count || ' likes',
      '/home'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 触发器
DROP TRIGGER IF EXISTS like_notification_trigger ON post_likes;
CREATE TRIGGER like_notification_trigger
AFTER INSERT ON post_likes
FOR EACH ROW
EXECUTE FUNCTION notify_post_like();

-- ============================================
-- 4. 内容审核结果通知（给 Creator）
-- ============================================

CREATE OR REPLACE FUNCTION notify_review_result()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 只在状态变更为 approved 或 rejected 时通知
  IF NEW.review_status IN ('approved', 'rejected') AND 
     (OLD.review_status IS DISTINCT FROM NEW.review_status) THEN
    
    IF NEW.review_status = 'approved' THEN
      -- 审核通过通知
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        link
      ) VALUES (
        NEW.creator_id,
        'payment',
        'Content Approved!',
        'Your content has been approved and is now live',
        '/home'
      );
    ELSIF NEW.review_status = 'rejected' THEN
      -- 审核拒绝通知
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        link
      ) VALUES (
        NEW.creator_id,
        'mention',
        'Content Needs Revision',
        'Your content was not approved. Reason: ' || COALESCE(NEW.rejection_reason, 'Please review our guidelines'),
        '/creator/studio/post/list'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 触发器
DROP TRIGGER IF EXISTS review_notification_trigger ON posts;
CREATE TRIGGER review_notification_trigger
AFTER UPDATE ON posts
FOR EACH ROW
WHEN (NEW.review_status IS DISTINCT FROM OLD.review_status)
EXECUTE FUNCTION notify_review_result();

-- ============================================
-- 5. 授予权限
-- ============================================

GRANT EXECUTE ON FUNCTION notify_new_subscription() TO authenticated;
GRANT EXECUTE ON FUNCTION notify_ppv_purchase() TO authenticated;
GRANT EXECUTE ON FUNCTION notify_post_like() TO authenticated;
GRANT EXECUTE ON FUNCTION notify_review_result() TO authenticated;

-- ============================================
-- 6. 验证
-- ============================================

SELECT '✅ Notification triggers created successfully' AS status;
