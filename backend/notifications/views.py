from django.utils import timezone
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.serializers import PublicUserSerializer
from training.student_views import SessionSummarySerializer

from .models import Notification

PAGE_SIZE = 50


class NotificationSerializer(serializers.ModelSerializer):
    session = SessionSummarySerializer(read_only=True)
    subject = PublicUserSerializer(read_only=True)

    class Meta:
        model = Notification
        fields = ["id", "kind", "session", "subject", "created_at", "read_at"]


class NotificationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = NotificationSerializer

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user).select_related("session", "subject")

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        return Response(
            {
                "unread": queryset.filter(read_at__isnull=True).count(),
                "results": self.get_serializer(queryset[:PAGE_SIZE], many=True).data,
            }
        )

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        notification = self.get_object()
        if notification.read_at is None:
            notification.read_at = timezone.now()
            notification.save(update_fields=["read_at"])
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        self.get_queryset().filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response({"unread": 0})
