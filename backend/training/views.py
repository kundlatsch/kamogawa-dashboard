from rest_framework import viewsets

from accounts.permissions import IsStaffRole, IsStaffRoleOrReadOnly

from .models import Drill, DrillCategory
from .serializers import DrillCategorySerializer, DrillSerializer


class DrillCategoryViewSet(viewsets.ModelViewSet):
    queryset = DrillCategory.objects.all()
    serializer_class = DrillCategorySerializer
    permission_classes = [IsStaffRoleOrReadOnly]


class DrillViewSet(viewsets.ModelViewSet):
    """Drill library. Deleting archives the drill so past sessions keep their history."""

    serializer_class = DrillSerializer
    permission_classes = [IsStaffRole]

    def get_queryset(self):
        queryset = Drill.objects.select_related("category")
        if self.request.query_params.get("include_archived") != "true":
            queryset = queryset.filter(archived=False)
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        instance.archived = True
        instance.save(update_fields=["archived", "updated_at"])
