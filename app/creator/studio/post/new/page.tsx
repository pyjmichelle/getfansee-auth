"use client"

import type React from "react"

import { useState } from "react"
import { ArrowLeft, Upload, ImageIcon, Video, DollarSign, Lock, Globe, Check } from "lucide-react"
import { NavHeader } from "@/components/nav-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function NewPostPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [postType, setPostType] = useState<"free" | "subscribers" | "ppv">("subscribers")
  const [content, setContent] = useState("")
  const [price, setPrice] = useState("")
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null)
  const [hasMedia, setHasMedia] = useState(false)

  const currentUser = {
    username: "sophia_creative",
    role: "creator" as const,
    avatar: "/creator-avatar.png",
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasMedia) {
      alert("Please upload media for your post")
      return
    }

    setIsSubmitting(true)

    // Simulate upload
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Navigate to publish success page with state
    router.push(`/creator/studio/post/success?type=${postType}&price=${price}`)
  }

  const handleMediaUpload = () => {
    // Simulate file upload
    setHasMedia(true)
  }

  return (
    <div className="min-h-screen bg-background">
      <NavHeader user={currentUser} notificationCount={5} />

      <main className="container max-w-3xl mx-auto px-4 py-6">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link href="/creator/studio">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Studio
          </Link>
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Create New Post</h1>
          <p className="text-muted-foreground">Share content with your audience</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Media Upload */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Upload Media *</h2>

            {!mediaType ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setMediaType("image")}
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors"
                >
                  <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground">Upload Image</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 10MB</p>
                </button>

                <button
                  type="button"
                  onClick={() => setMediaType("video")}
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors"
                >
                  <Video className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground">Upload Video</p>
                  <p className="text-xs text-muted-foreground mt-1">MP4, MOV up to 500MB</p>
                </button>
              </div>
            ) : !hasMedia ? (
              <div>
                <button
                  type="button"
                  onClick={handleMediaUpload}
                  className="w-full border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
                >
                  <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground mb-1">
                    Click to upload {mediaType === "image" ? "image" : "video"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {mediaType === "image" ? "PNG, JPG up to 10MB" : "MP4, MOV up to 500MB"}
                  </p>
                </button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setMediaType(null)} className="mt-3">
                  Change media type
                </Button>
              </div>
            ) : (
              <div className="border border-border rounded-lg p-6 bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded bg-green-500/10 flex items-center justify-center">
                    <Check className="w-6 h-6 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">Media uploaded successfully</p>
                    <p className="text-sm text-muted-foreground">
                      {mediaType === "image" ? "Image" : "Video"} ready to publish
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setHasMedia(false)}>
                    Change
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Post Details */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Post Details</h2>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="content">Caption *</Label>
                <Textarea
                  id="content"
                  placeholder="Write something about your post..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  className="min-h-[120px] resize-none"
                />
              </div>
            </div>
          </Card>

          {/* Post Type & Pricing */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Visibility & Pricing *</h2>

            <RadioGroup value={postType} onValueChange={(value: any) => setPostType(value)} className="space-y-3">
              <div className="flex items-start space-x-3 p-4 border border-border rounded-lg hover:border-primary/50 transition-colors">
                <RadioGroupItem value="free" id="free" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="free" className="flex items-center gap-2 font-semibold cursor-pointer">
                    <Globe className="w-4 h-4" />
                    Free Post
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">Visible to everyone, including non-subscribers</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    <strong>Best for:</strong> Teasers to attract new subscribers
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-4 border-2 border-primary/50 bg-primary/5 rounded-lg">
                <RadioGroupItem value="subscribers" id="subscribers" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="subscribers" className="flex items-center gap-2 font-semibold cursor-pointer">
                    <Lock className="w-4 h-4" />
                    Subscribers Only (Recommended)
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">Only your active subscribers can see this</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    <strong>Best for:</strong> Regular content for your subscribers
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-4 border border-border rounded-lg hover:border-primary/50 transition-colors">
                <RadioGroupItem value="ppv" id="ppv" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="ppv" className="flex items-center gap-2 font-semibold cursor-pointer">
                    <DollarSign className="w-4 h-4" />
                    Pay Per View
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    Anyone can purchase to unlock (one-time payment)
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    <strong>Best for:</strong> Premium exclusive content
                  </p>
                  {postType === "ppv" && (
                    <div className="space-y-2 mt-3">
                      <Label htmlFor="price" className="text-sm">
                        Price (USD) *
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <Input
                          id="price"
                          type="number"
                          placeholder="25.00"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          required={postType === "ppv"}
                          min="1"
                          step="0.01"
                          className="h-11 pl-8"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Recommended: $10 - $50 for premium content</p>
                    </div>
                  )}
                </div>
              </div>
            </RadioGroup>
          </Card>

          {/* Submit */}
          <div className="flex gap-3">
            <Button asChild variant="outline" className="flex-1 bg-transparent">
              <Link href="/creator/studio">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting || !hasMedia} className="flex-1">
              {isSubmitting ? "Publishing..." : "Publish Post"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
