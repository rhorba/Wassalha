'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form'

const FeedbackSchema = z.object({
  message: z.string().min(10, 'Minimum 10 caractères').max(500, 'Maximum 500 caractères'),
})
type FeedbackForm = z.infer<typeof FeedbackSchema>

export function FeedbackButton() {
  const [open, setOpen] = useState(false)

  const form = useForm<FeedbackForm>({
    resolver: zodResolver(FeedbackSchema),
    defaultValues: { message: '' },
  })

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: FeedbackForm) => {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, page: window.location.pathname }),
      })
      if (!res.ok) throw new Error('Failed to submit feedback')
    },
    onSuccess: () => {
      toast.success('Merci pour votre retour !')
      form.reset()
      setOpen(false)
    },
    onError: () => {
      toast.error("Erreur lors de l'envoi. Réessayez.")
    },
  })

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" className="shadow-md gap-2">
            <MessageSquare className="h-4 w-4" />
            Feedback
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end" side="top">
          <p className="text-sm font-medium mb-3">Donnez-nous votre avis</p>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => mutate(d))} className="space-y-3">
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="Décrivez votre expérience ou signalez un problème..."
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" size="sm" className="w-full" disabled={isPending}>
                {isPending ? 'Envoi...' : 'Envoyer'}
              </Button>
            </form>
          </Form>
        </PopoverContent>
      </Popover>
    </div>
  )
}
