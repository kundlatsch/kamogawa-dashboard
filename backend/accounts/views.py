from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response

from .models import Gym, User
from .passwords import generate_password
from .permissions import IsAccountAdmin, IsCoach
from .serializers import (
    ChangePasswordSerializer,
    GymSerializer,
    NewAccountSerializer,
    OwnGymSerializer,
    ProfileSerializer,
    UserSerializer,
)


@api_view(["GET", "PATCH"])
def me(request):
    """The signed-in user; PATCH updates their own display name, emoji and color."""
    if request.method == "PATCH":
        serializer = ProfileSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
    return Response(UserSerializer(request.user).data)


@api_view(["POST"])
def change_password(request):
    """Any signed-in user changes their own password by confirming the current one."""
    serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    request.user.set_password(serializer.validated_data["new_password"])
    request.user.save(update_fields=["password"])
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "PATCH"])
@permission_classes([IsCoach])
def my_gym(request):
    """Coaches edit their own gym's name and student-area color."""
    gym = request.user.gym
    if request.method == "PATCH":
        serializer = OwnGymSerializer(gym, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
    return Response(OwnGymSerializer(gym).data)


def create_account(gym: Gym, role: str, data: dict) -> tuple[User, str]:
    password = generate_password()
    user = User(**data, role=role, gym=gym)
    user.set_password(password)
    user.save()
    return user, password


class ManagedAccountViewSet(viewsets.ModelViewSet):
    """Accounts of one role inside one gym, with server-generated passwords.

    The generated password is returned once (on create and on reset) so it can be
    handed to the person; it is never stored in plain text. Deleting an account
    deactivates it, keeping training history intact.
    """

    serializer_class = UserSerializer
    managed_role: str = ""

    def get_gym(self) -> Gym:
        raise NotImplementedError

    def get_queryset(self):
        queryset = User.objects.filter(role=self.managed_role, gym=self.get_gym()).select_related("gym")
        if self.request.query_params.get("include_inactive") != "true":
            queryset = queryset.filter(is_active=True)
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = NewAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user, password = create_account(self.get_gym(), self.managed_role, serializer.validated_data)
        data = {**self.get_serializer(user).data, "generated_password": password}
        return Response(data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active"])

    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, *args, **kwargs):
        user = self.get_object()
        password = generate_password()
        user.set_password(password)
        user.save(update_fields=["password"])
        return Response({"id": user.id, "generated_password": password})


class StudentViewSet(ManagedAccountViewSet):
    """Coaches manage the students of their own gym."""

    managed_role = User.Role.STUDENT
    permission_classes = [IsCoach]

    def get_gym(self):
        return self.request.user.gym


class GymCoachViewSet(ManagedAccountViewSet):
    """Account admins manage the coaches of any gym: /api/gyms/{gym_pk}/coaches/."""

    managed_role = User.Role.COACH
    permission_classes = [IsAccountAdmin]

    def get_gym(self):
        return get_object_or_404(Gym, pk=self.kwargs["gym_pk"])


class GymViewSet(viewsets.ModelViewSet):
    """Account admins create gyms (optionally with their first coaches) and manage them.

    Deleting a gym deactivates it: its members can no longer use the app, data is kept.
    """

    serializer_class = GymSerializer
    permission_classes = [IsAccountAdmin]

    def get_queryset(self):
        active = Q(members__is_active=True)
        return Gym.objects.annotate(
            coach_count=Count("members", filter=active & Q(members__role=User.Role.COACH), distinct=True),
            student_count=Count("members", filter=active & Q(members__role=User.Role.STUDENT), distinct=True),
        )

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        coaches = serializer.validated_data.pop("coaches", [])
        gym = Gym.objects.create(**serializer.validated_data)
        credentials = []
        for data in coaches:
            user, password = create_account(gym, User.Role.COACH, data)
            credentials.append({"username": user.username, "generated_password": password})
        data = {**self.get_serializer(self.get_queryset().get(pk=gym.pk)).data, "coach_credentials": credentials}
        return Response(data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active"])
