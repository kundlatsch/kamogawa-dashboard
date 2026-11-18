from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from accounts.avatars import InvalidImage, process_badge
from accounts.models import User
from accounts.permissions import IsCoach, IsGymMember
from accounts.serializers import PublicUserSerializer
from training.cycle_views import ArchivableListViewSet
from training.absences import week_start
from training.models import CheckIn, WeeklyAbsence

from .models import FighterClass
from .serializers import FighterClassSerializer


class FighterClassViewSet(ArchivableListViewSet):
    serializer_class = FighterClassSerializer
    model = FighterClass

    @action(detail=True, methods=["post", "delete"], parser_classes=[MultiPartParser])
    def image(self, request, pk=None):
        """Upload (multipart field `image`) or remove a custom picture for the class."""
        fighter_class = self.get_object()
        if request.method == "DELETE":
            if fighter_class.image:
                fighter_class.image.delete(save=True)
        else:
            upload = request.FILES.get("image")
            if upload is None:
                raise ValidationError({"image": "Send an image in the `image` field."})
            try:
                content = process_badge(upload)
            except InvalidImage as error:
                raise ValidationError({"image": str(error)})
            old = fighter_class.image.name if fighter_class.image else None
            fighter_class.image.save(content.name, content, save=True)
            if old:
                fighter_class.image.storage.delete(old)
        return Response(self.get_serializer(fighter_class).data)


@api_view(["GET"])
@permission_classes([IsCoach])
def leaderboard(request):
    """Every active student with fighter class and attendance (the UI sorts the ranking)."""
    return Response(ranking_rows(request.user.gym))


@api_view(["GET"])
@permission_classes([IsGymMember])
def ranking(request):
    """Read-only ranking for students: the same rows as the coach sees."""
    return Response(ranking_rows(request.user.gym))


def ranking_rows(gym) -> list[dict]:
    students = User.objects.filter(gym=gym, role=User.Role.STUDENT, is_active=True).order_by("display_name")
    attendance = attendance_by_student(gym, students)
    return [
        {
            "student": PublicUserSerializer(student).data,
            "fighter_class": student.fighter_class_id,
            **attendance[student.id],
        }
        for student in students
    ]


def attendance_by_student(gym, students) -> dict[int, dict]:
    """Classes attended and absences per student.

    A check-in for a class up to today counts as attended unless the coach marked it as missed.
    Absences are the weekly totals recorded every Sunday (committed classes minus attended, see
    training/absences.py) plus classes the coach marked as missed in weeks not closed yet.
    """
    today = timezone.localdate()
    ids = [student.id for student in students]
    attended = dict(
        CheckIn.objects.filter(student_id__in=ids, session__gym=gym, session__date__lte=today)
        .exclude(attended=False)
        .values("student")
        .annotate(n=Count("id"))
        .values_list("student", "n")
    )
    recorded = dict(
        WeeklyAbsence.objects.filter(student_id__in=ids)
        .values("student")
        .annotate(n=Sum("missed"))
        .values_list("student", "n")
    )
    closed_weeks = set(WeeklyAbsence.objects.filter(student_id__in=ids).values_list("student", "week_start"))
    open_misses: dict[int, int] = {}
    for student_id, day in CheckIn.objects.filter(student_id__in=ids, attended=False).values_list(
        "student", "session__date"
    ):
        if (student_id, week_start(day)) not in closed_weeks:
            open_misses[student_id] = open_misses.get(student_id, 0) + 1
    return {
        student.id: {
            "attended": attended.get(student.id, 0),
            "absences": (recorded.get(student.id) or 0) + open_misses.get(student.id, 0),
        }
        for student in students
    }
