from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import IsCoach, IsGymMember
from training.cycle_views import ArchivableListViewSet
from training.views import parse_date

from .models import Assessment, Metric
from .serializers import AssessmentSerializer, MetricSerializer, SetAssessmentSerializer, month_start


class MetricViewSet(ArchivableListViewSet):
    serializer_class = MetricSerializer
    model = Metric


def gym_assessments(gym):
    return Assessment.objects.filter(student__gym=gym, metric__gym=gym)


@api_view(["GET"])
@permission_classes([IsCoach])
def assessments(request):
    """Scores of the coach's gym; filter with `?period=` (any day of the month) and `?student=`."""
    queryset = gym_assessments(request.user.gym)
    params = request.query_params
    if "period" in params:
        queryset = queryset.filter(period=month_start(parse_date(params["period"], "period")))
    if "student" in params:
        queryset = queryset.filter(student_id=params["student"])
    return Response(AssessmentSerializer(queryset, many=True).data)


@api_view(["POST"])
@permission_classes([IsCoach])
def set_assessment(request):
    serializer = SetAssessmentSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    key = {"student": data["student"], "metric": data["metric"], "period": data["period"]}
    if data["score"] is None:
        Assessment.objects.filter(**key).delete()
        return Response(status=204)
    assessment, _ = Assessment.objects.update_or_create(
        **key, defaults={"score": data["score"], "notes": data["notes"], "assessed_by": request.user}
    )
    return Response(AssessmentSerializer(assessment).data)


@api_view(["GET"])
@permission_classes([IsGymMember])
def my_assessments(request):
    """The signed-in student's full score history, oldest month first."""
    return Response(AssessmentSerializer(gym_assessments(request.user.gym).filter(student=request.user), many=True).data)
